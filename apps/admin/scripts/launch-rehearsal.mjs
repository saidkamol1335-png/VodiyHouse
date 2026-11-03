// Репетиция запуска Проекта-2 на копии прода (фаза F, п. 44): только чтение прода, копия — в памяти.
//   node --env-file=<env прода> scripts/launch-rehearsal.mjs
// 1. Заглушка Supabase и ровно те миграции, что применены в проде (supabase_migrations), — в PGlite.
// 2. Строки прода (public, private, auth.users, storage) — в копию одной транзакцией «только чтение».
// 3. Снимок «до»: число строк, ответы функций сайта (site_*), которыми живёт сайт.
// 4. Недостающие миграции Проекта-2 по одной — ошибка любой останавливает репетицию.
// 5. Снимок «после» и сверка; вызовы rpc кода release/project-1 — есть ли функции с теми же аргументами
//    (окно между миграциями и переключением сайта на main).
// Печатает только числа и имена таблиц и функций: персональные данные (заявки, телефоны) не выводятся
// и на диск не пишутся. Код выхода 1 — расхождение или ошибка.

import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import pg from "pg";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";

const ROOT = path.join(import.meta.dirname, "..", "..", "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const SHIM = path.join(import.meta.dirname, "..", "tests", "db", "supabase-shim.sql");
const SCHEMAS = ["public", "private"];
// Из служебных схем Supabase — только то, на что опираются миграции и права.
const EXTRA_TABLES = ["auth.users", "storage.buckets", "storage.objects"];
const RELEASE = process.env.REHEARSAL_RELEASE_REF || "release/project-1";

let failed = false;
const fail = (text) => {
  failed = true;
  console.log(`  ✗ ${text}`);
};
const ok = (text) => console.log(`  ✓ ${text}`);

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL не задан: node --env-file=<env прода> scripts/launch-rehearsal.mjs");

const prod = new pg.Client(dbClientConfig(url));
await prod.connect();
await prod.query("begin transaction isolation level repeatable read read only");

console.log("\n1. Схема прода в PGlite");
const applied = (await prod.query("select version from supabase_migrations.schema_migrations order by version")).rows.map(
  (row) => row.version,
);
const files = (await readdir(MIGRATIONS)).filter((file) => file.endsWith(".sql")).sort();
const byVersion = new Map(files.map((file) => [file.split("_")[0], file]));
const missingFiles = applied.filter((version) => !byVersion.has(version));
if (missingFiles.length) fail(`в проде есть миграции, которых нет в репозитории: ${missingFiles.join(", ")}`);
const pending = files.filter((file) => !applied.includes(file.split("_")[0]));
const copy = await PGlite.create({ extensions: { pgcrypto } });
await copy.exec(await readFile(SHIM, "utf8"));
for (const version of applied) await copy.exec(await readFile(path.join(MIGRATIONS, byVersion.get(version)), "utf8"));
ok(`в проде ${applied.length} миграций, к применению ${pending.length}: ${pending.map((f) => f.split("_")[0]).join(", ")}`);

console.log("\n2. Строки прода → копия");
const tables = (
  await prod.query(
    `select table_schema || '.' || table_name as name from information_schema.tables
      where table_type = 'BASE TABLE' and table_schema = any($1) order by 1`,
    [SCHEMAS],
  )
).rows
  .map((row) => row.name)
  .concat(EXTRA_TABLES);

const columnsOf = async (db, table) => {
  const [schema, name] = table.split(".");
  const { rows } = await db.query(
    `select a.attname as name from pg_attribute a
       join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = $2 and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
      order by a.attnum`,
    [schema, name],
  );
  return rows.map((row) => row.name);
};

await copy.exec("set session_replication_role = replica");
// Строки, которые вставили сами миграции (настройки, справочники, бакеты), — заменяются строками прода.
const existing = [];
for (const table of tables) if ((await columnsOf(copy, table)).length) existing.push(table);
await copy.exec(`truncate ${existing.join(", ")} restart identity cascade`);
const counts = {};
for (const table of tables) {
  const target = await columnsOf(copy, table);
  if (target.length === 0) {
    fail(`${table}: таблицы нет в копии (схема прода расходится с миграциями)`);
    continue;
  }
  const source = new Set(await columnsOf(prod, table));
  const shared = target.filter((column) => source.has(column)).map((column) => `"${column}"`).join(", ");
  const { rows } = await prod.query(`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows from ${table} t`);
  counts[table] = rows[0].rows.length;
  if (counts[table] === 0) continue;
  try {
    await copy.query(
      `insert into ${table} (${shared}) overriding system value
       select ${shared} from jsonb_populate_recordset(null::${table}, $1::jsonb)`,
      [JSON.stringify(rows[0].rows)],
    );
  } catch (error) {
    // Только текст ошибки: в параметрах запроса — строки прода.
    fail(`${table}: ${error.message}`);
  }
}
await copy.exec("set session_replication_role = origin");
// Счётчики id — дальше максимума (вставки миграций и проверок не должны упираться в занятые id).
await copy.exec(`
  do $$
  declare r record;
  begin
    for r in
      select n.nspname, c.relname, a.attname, pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) as seq
      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'private') and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    loop
      if r.seq is not null then
        execute format('select setval(%L, greatest(coalesce((select max(%I) from %I.%I), 0), 1))', r.seq, r.attname, r.nspname, r.relname);
      end if;
    end loop;
  end $$;`);
const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0);
ok(`${tables.length} таблиц, с данными ${nonEmpty.length}: ${nonEmpty.map(([t, n]) => `${t.replace("public.", "")} ${n}`).join(", ")}`);
const heads = (await copy.query("select count(*)::int as n from public.profiles where role = 'head' and is_active")).rows[0].n;
const staff = (await copy.query("select role::text, count(*)::int as n from public.profiles group by 1 order by 1")).rows;
console.log(`  · сотрудники: ${staff.map((row) => `${row.role} ${row.n}`).join(", ") || "нет"}; активных руководителей ${heads}`);
await prod.query("rollback");
await prod.end();

console.log("\n3. Снимок «до»: функции сайта");
const siteFunctions = async () =>
  (
    await copy.query(
      `select p.proname as name, p.pronargs as args, p.pronargdefaults as defaults,
              coalesce(array_to_string(p.proargnames, ','), '') as arg_names,
              pg_get_function_identity_arguments(p.oid) as identity
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'site\\_%' order by 1`,
    )
  ).rows;
const slugs = async () => ({
  complex: (await copy.query("select slug from public.complexes where status = 'published' order by slug")).rows.map((r) => r.slug),
  developer: (await copy.query("select slug from public.developers where status = 'published' order by slug")).rows.map((r) => r.slug),
});
// Только чтение: функции записи сайта (заявки, события, старт Telegram) не вызываются.
const READ_ONLY = /^site_(catalog|complex|developers?|showcase|complex_progress|progress_report|room_stock|block_stock|calculator_available|calc_screen|slug_state|developer_slug_state|complex_faq|complex_picker)$/;
async function snapshot() {
  const result = {};
  const { complex, developer } = await slugs();
  for (const fn of await siteFunctions()) {
    if (!READ_ONLY.test(fn.name)) continue;
    const calls =
      fn.args - fn.defaults === 0
        ? [[]]
        : fn.args - fn.defaults === 1 && /slug/.test(fn.arg_names)
          ? (/developer/.test(fn.name) ? developer : complex).map((slug) => [slug])
          : [];
    for (const params of calls) {
      const key = `${fn.name}(${params.join(",")})`;
      try {
        const placeholders = params.map((_, index) => `$${index + 1}`).join(", ");
        const { rows } = await copy.query(`select to_jsonb(public.${fn.name}(${placeholders})) as r`, params);
        result[key] = JSON.stringify(rows[0].r);
      } catch (error) {
        result[key] = `ERROR ${error.message}`;
      }
    }
  }
  return result;
}
const before = await snapshot();
const beforeCounts = {};
for (const table of tables) beforeCounts[table] = (await copy.query(`select count(*)::int as n from ${table}`)).rows[0].n;
ok(`ответов функций сайта: ${Object.keys(before).length}`);

console.log("\n4. Миграции Проекта-2 на копии");
for (const file of pending) {
  try {
    await copy.exec(await readFile(path.join(MIGRATIONS, file), "utf8"));
    ok(file);
  } catch (error) {
    fail(`${file}: ${error.message}`);
    break;
  }
}

console.log("\n5. Сверка «до» и «после»");
for (const table of tables) {
  const now = (await copy.query(`select count(*)::int as n from ${table}`)).rows[0].n;
  if (now !== beforeCounts[table]) fail(`${table}: строк было ${beforeCounts[table]}, стало ${now}`);
}
ok("число строк во всех таблицах прода не изменилось");
const after = await snapshot();
let same = 0;
for (const [key, value] of Object.entries(before)) {
  if (!(key in after)) fail(`${key}: функции больше нет`);
  else if (after[key] === value) same += 1;
  else if (after[key].startsWith("ERROR")) fail(`${key}: после миграций ошибка — ${after[key].slice(6, 160)}`);
  else console.log(`  · ${key}: ответ изменился (${value.length} → ${after[key].length} знаков) — сверить вручную`);
}
ok(`ответы функций сайта без изменений: ${same} из ${Object.keys(before).length}`);
const drift = (
  await copy.query(
    `select count(*)::int as n from (
       select c.id from public.complexes c cross join lateral private.complex_state_now(c.id) s
        where (c.missing_count, c.site_state) is distinct from (s.missing_count, s.site_state)
       union all
       select l.id from public.layouts l join private.layout_completeness lc on lc.layout_id = l.id
        where l.is_complete is distinct from lc.is_complete) d`,
  )
).rows[0].n;
if (drift > 0) fail(`хранимое состояние ЖК и планировок расходится с посчитанным: ${drift}`);
else ok("хранимое состояние ЖК и планировок совпадает с посчитанным");


console.log(`\n6. Вызовы rpc кода ${RELEASE} после миграций`);
const releaseCode = execFileSync("git", ["grep", "-hoE", 'rpc[(]"[a-z_]+"(, *[{][^}]*[}])?', RELEASE, "--", "apps/site"], {
  cwd: ROOT,
  encoding: "utf8",
});
const calls = new Map();
for (const line of releaseCode.split("\n").filter(Boolean)) {
  const name = /rpc\("([a-z_]+)"/.exec(line)[1];
  const keys = [...(line.match(/\{([^}]*)\}/)?.[1] ?? "").matchAll(/(p_[a-z_]+)/g)].map((match) => match[1]);
  calls.set(name, [...new Set([...(calls.get(name) ?? []), ...keys])]);
}
const procs = (
  await copy.query(
    `select p.proname as name, coalesce(p.proargnames, '{}') as names from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`,
  )
).rows;
const changed = [];
for (const [name, keys] of calls) {
  const candidates = procs.filter((proc) => proc.name === name);
  if (candidates.length === 0) changed.push(`${name} — функции нет`);
  else if (!candidates.some((proc) => keys.every((key) => proc.names.includes(key))))
    changed.push(`${name}(${keys.join(", ")}) — другие аргументы`);
}
// Публичные страницы release (site_*) должны пережить окно между миграциями и переключением сайта.
const sitePages = changed.filter((line) => line.startsWith("site_"));
for (const line of changed) console.log(`  · ${line}`);
if (sitePages.length) fail(`функции сайта release после миграций: ${sitePages.join("; ")}`);
ok(`rpc release: ${calls.size}, без изменений ${calls.size - changed.length}; изменённые не site_* — кабинет release, его заменит кабинет main`);

await copy.close();
console.log(failed ? "\nЕсть ✗ — запуск по сценарию не начинать." : "\nРепетиция пройдена.");
process.exitCode = failed ? 1 : 0;
