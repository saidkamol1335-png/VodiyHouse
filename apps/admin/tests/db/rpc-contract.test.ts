import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

// PostgREST ищет функцию по набору имён аргументов, а типов базы в коде нет: опечатка в p_* или
// новая перегрузка проходят lint, typecheck, PGlite (тесты зовут функции позиционно) и стенды
// (там demo-действия) — и ломают кабинет только в облаке. Сверяем каждый вызов rpc с pg_proc.

type RpcCall = { file: string; name: string; keys: string[] };
type FunctionArgs = { name: string; inputs: string[]; required: string[] };

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_DIRS = ["lib", "app"];

describe("вызовы rpc совпадают с функциями базы", () => {
  let db: TestDb;
  let calls: RpcCall[];

  beforeAll(async () => {
    db = await createTestDb();
    calls = (await Promise.all(SOURCE_DIRS.map(sourceFiles))).flat().flatMap(rpcCallsOf);
  });

  afterAll(async () => {
    await db.close();
  });

  it("каждый вызов: функция одна, ключи — её аргументы, обязательные переданы", async () => {
    expect(calls.length).toBeGreaterThan(30);
    const functions = await functionArgs(db, [...new Set(calls.map((call) => call.name))]);
    for (const call of calls) {
      const where = `${call.file}: ${call.name}`;
      const overloads = functions.filter((fn) => fn.name === call.name);
      expect(overloads, where).toHaveLength(1);
      const [fn] = overloads;
      expect(
        call.keys.filter((key) => !fn!.inputs.includes(key)),
        where,
      ).toEqual([]);
      expect(
        fn!.required.filter((arg) => !call.keys.includes(arg)),
        where,
      ).toEqual([]);
    }
  });

  it("разбор вызовов видит многострочные объекты, вложенные скобки и имя из переменной", () => {
    const source = `
      const fn: "add_a" | "add_b" = pick();
      await supabase.rpc(fn, { p_one: 1, p_two: f({ x: 1, y: [2, 3] }) });
      await supabase.rpc("plain");
      await supabase.rpc("short", { p_block }, );
      await supabase.rpc<Row>('set_v2', { p_x: "}", p_y: 2 });
    `;
    expect(rpcCallsOf({ file: "x.ts", source })).toEqual([
      { file: "x.ts", name: "add_a", keys: ["p_one", "p_two"] },
      { file: "x.ts", name: "add_b", keys: ["p_one", "p_two"] },
      { file: "x.ts", name: "plain", keys: [] },
      { file: "x.ts", name: "short", keys: ["p_block"] },
      { file: "x.ts", name: "set_v2", keys: ["p_x", "p_y"] },
    ]);
    const template = "supabase.rpc(`set_${kind}_media`, { p_a: 1 })";
    expect(() => rpcCallsOf({ file: "y.ts", source: template })).toThrow(/без имени-строки: 1/);
  });
});

async function sourceFiles(dir: string): Promise<{ file: string; source: string }[]> {
  const entries = await readdir(path.join(ROOT, dir), { recursive: true });
  const files = entries.filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
  return Promise.all(
    files.map(async (file) => ({
      file: path.join(dir, file),
      source: await readFile(path.join(ROOT, dir, file), "utf8"),
    })),
  );
}

// Имя — строкой в любых кавычках или переменной; .rpc<T>( — тоже вызов.
const CALL =
  /\.rpc\s*(?:<[^>]*>)?\s*\(\s*(?:(["'`])([a-z_][a-z0-9_]*)\1|([A-Za-z_]\w*))\s*(,\s*\{)?/g;
const ANY_CALL = /\.rpc\s*(?:<[^>]*>)?\s*\(/g;

function rpcCallsOf({ file, source }: { file: string; source: string }): RpcCall[] {
  const calls: RpcCall[] = [];
  const matches = [...source.matchAll(CALL)];
  // Не разобранный вызов (шаблонная строка, выражение) не должен проскочить молча.
  const unparsed = [...source.matchAll(ANY_CALL)].length - matches.length;
  if (unparsed > 0) throw new Error(`${file}: вызовов rpc без имени-строки: ${unparsed}`);
  for (const match of matches) {
    const names = match[2] ? [match[2]] : namesOfVariable(source, match[3]!);
    const keys = match[4] ? topLevelKeys(source, match.index + match[0].length) : [];
    for (const name of names) calls.push({ file, name, keys });
  }
  return calls;
}

/** Имя функции из переменной с типом-объединением строк: `fn: "add_a" | "add_b"`. */
function namesOfVariable(source: string, variable: string): string[] {
  const union = new RegExp(`\\b${variable}:\\s*((?:"[a-z_]+"\\s*\\|?\\s*)+)`).exec(source);
  const names = [...(union?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((name) => name[1]!);
  if (names.length === 0) throw new Error(`rpc(${variable}): имя функции не найти`);
  return names;
}

/** Ключи объекта верхнего уровня с позиции сразу после «{»; значения со скобками пропускаются. */
function topLevelKeys(source: string, start: number): string[] {
  const keys: string[] = [];
  let depth = 0;
  let segment = "";
  let quote: string | null = null;
  for (const char of source.slice(start)) {
    // Скобки и запятые внутри строкового значения — не разметка объекта.
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (depth === 0 && (char === "," || char === "}")) {
      keys.push(/^\s*([A-Za-z_]\w*)\s*(?::|$)/.exec(segment)?.[1] ?? "");
      if (char === "}") break;
      segment = "";
      continue;
    }
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth -= 1;
    else if (depth === 0) segment += char;
  }
  return keys.filter(Boolean);
}

async function functionArgs(db: TestDb, names: string[]): Promise<FunctionArgs[]> {
  const { rows } = await db.admin.query<{
    name: string;
    arg_names: string[] | null;
    arg_modes: string[] | null;
    defaults: number;
  }>(
    `select proname as name, proargnames as arg_names, proargmodes::text[] as arg_modes,
            pronargdefaults as defaults
     from pg_proc where pronamespace = 'public'::regnamespace and proname = any ($1)`,
    [names],
  );
  return rows.map((row) => {
    const all = row.arg_names ?? [];
    // Аргументы вызова — режимы i, b, v (или все, если режимов нет); t и o — столбцы ответа.
    const inputs = all.filter((_, at) => !row.arg_modes || "ibv".includes(row.arg_modes[at]!));
    return { name: row.name, inputs, required: inputs.slice(0, inputs.length - row.defaults) };
  });
}
