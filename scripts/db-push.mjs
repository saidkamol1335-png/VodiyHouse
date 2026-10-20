// Миграции в облачную базу без `supabase login` и `link`: по SUPABASE_DB_URL из .env.local.
// `npm run db:push` — применить; `npm run db:push -- --dry-run` — только показать, что применится.

import { spawnSync } from "node:child_process";
import path from "node:path";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Нет SUPABASE_DB_URL в .env.local — строка подключения к базе, см. .env.example.");
  process.exit(1);
}

const cli = path.join(import.meta.dirname, "..", "node_modules", "supabase", "dist", "supabase.js");
const result = spawnSync(
  process.execPath,
  [cli, "db", "push", "--db-url", connectionString, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
