// Одна миграция в облачную базу (по SUPABASE_DB_URL из .env.local) — мимо `db:push`: тот требует
// сначала выкатить неодобренную 20261103210000_reviews.sql (--include-all). Файл и запись в
// supabase_migrations.schema_migrations — в одной транзакции; уже применённую не трогает.
//   npm run db:apply -w @vh/admin -- 20261117100000_site_faq.sql [--dry-run]
// Строку подключения не печатает.

import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "..", "..", "supabase", "migrations");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((arg) => !arg.startsWith("--"));
const match = file ? /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(path.basename(file)) : null;
if (!match) {
  console.error("Укажите файл миграции: 20261117100000_site_faq.sql");
  process.exit(1);
}
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Нет SUPABASE_DB_URL в .env.local.");
  process.exit(1);
}

const [, version, name] = match;
const sql = await readFile(path.join(MIGRATIONS_DIR, path.basename(file)), "utf8");
const client = new pg.Client(dbClientConfig(connectionString));
await client.connect();
try {
  const host = new URL(connectionString).hostname;
  const { rows: project } = await client.query("select current_database() as db");
  console.log(`База: ${project[0].db} @ ${host.replace(/^[^.]+/, "…")}`);
  const { rows } = await client.query("select 1 from supabase_migrations.schema_migrations where version = $1", [version]);
  if (rows.length > 0) {
    console.log(`${version}_${name}: уже применена — ничего не делаю.`);
  } else if (dryRun) {
    console.log(`${version}_${name}: будет применена (--dry-run — ничего не делаю).`);
  } else {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
      [version, name, [sql]],
    );
    await client.query("commit");
    console.log(`${version}_${name}: применена.`);
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error("Миграция не применена:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
