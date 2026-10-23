import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Граф импортов для структурных тестов: какие модули достижимы из корней маршрутов.
// Разбор — регулярным выражением по import / export from / import(): сборщик не нужен,
// а пропустить модуль страшнее, чем взять лишний (лишний только ужесточает проверку).

const ROOT = process.cwd();
const EXTENSIONS = [".tsx", ".ts", "/index.ts", "/index.tsx"];
const IMPORT =
  /(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

export const readSource = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;
  if (existsSync(base) && statSync(base).isFile()) return /\.tsx?$/.test(base) ? base : null;
  for (const extension of EXTENSIONS) if (existsSync(base + extension)) return base + extension;
  return null;
}

function importsOf(file: string, source: string): string[] {
  return [...source.matchAll(IMPORT)]
    .map((match) => resolveImport(file, match[1] ?? match[2]!))
    .filter((target): target is string => target !== null);
}

/** Все модули проекта (.ts / .tsx), достижимые из входных файлов, включая их самих. */
export function reachableModules(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const stack = entries.map((entry) => path.resolve(ROOT, entry));
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    stack.push(...importsOf(file, readSource(file)));
  }
  return [...seen];
}

/**
 * Модули, которые уйдут в браузер: с "use client" и всё, что они импортируют, — граница
 * клиента наследуется (Logo без директивы, но в шапке-клиенте он клиентский).
 */
export function reachableClientModules(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const client = new Set<string>();
  const stack = entries.map((entry) => ({ file: path.resolve(ROOT, entry), inClient: false }));
  while (stack.length > 0) {
    const { file, inClient: parentInClient } = stack.pop()!;
    const source = readSource(file);
    const inClient = parentInClient || /^["']use client["']/m.test(source);
    // Один файл бывает и серверным, и клиентским — обходим его в каждой роли по разу.
    const key = `${inClient}:${file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (inClient) client.add(file);
    for (const target of importsOf(file, source)) stack.push({ file: target, inClient });
  }
  return [...client];
}

/** Страницы и layout маршрутов под папкой (без тестов). */
export function routeFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(relative);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [relative] : [];
  });
}

/** Корень /admin вне кабинета: вход, смена пароля, ошибка — свои CSS и сообщения. */
export const adminRootFiles = () =>
  routeFiles("app/admin").filter((file) => !/[\\/]\(cabinet\)[\\/]/.test(file));

/** Папка компонента (components/<Имя>/…) или null. */
export function componentOf(file: string): string | null {
  return /components[\\/]([^\\/]+)[\\/]/.exec(path.relative(ROOT, file))?.[1] ?? null;
}
