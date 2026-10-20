// Тесты базы (tests/db) против облака: `npm run test:db:remote`. Файлы — по одному: каждый
// держит свою транзакцию и откатывает её, параллельные транзакции ждали бы друг друга.

import { spawnSync } from "node:child_process";
import path from "node:path";

if (!process.env.SUPABASE_DB_URL) {
  console.error("Нет SUPABASE_DB_URL в .env.local — строка подключения к базе, см. .env.example.");
  process.exit(1);
}

const vitest = path.join(import.meta.dirname, "..", "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(
  process.execPath,
  [vitest, "run", "--project", "db", "--no-file-parallelism", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, DB_TEST_TARGET: "remote" } },
);
process.exit(result.status ?? 1);
