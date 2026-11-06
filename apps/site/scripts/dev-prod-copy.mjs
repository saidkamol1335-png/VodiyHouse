// Локальная копия прода для дизайна и анимаций (03.11.2026; с 06.11 — из main, он и есть прод): код этой ветки (main —
// из неё собирается vodiyhouse-prod.netlify.app) + база прода, горячая перезагрузка. `npm run
// dev:prod -w @vh/site` → http://localhost:3006. Ключи — из .env.prod (как у сайта Netlify), ключи
// тестового облака из .env.local гасятся: Next не перезаписывает уже заданную переменную, даже пустую.
// Service-ключа нет: копия только читает — заявки отвечают «недоступно», события не пишутся, так что
// проверка форм не оставляет в проде фейковых заявок и не съедает номер #1001.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseEnv } from "node:util";

const SITE_DIR = path.join(import.meta.dirname, "..");
const PORT = process.env.PORT ?? "3006";
const WRITE_KEYS = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_DB_PASSWORD",
  "CRON_SECRET",
  // Заявки и события сайт пишет подписью (lib/supabase/signedWrite.ts), а не service-ключом: без этого
  // ключа копия писала бы в прод настоящие события и заявки (найдено ревью 06.11.2026).
  "SITE_SIGNING_SECRET",
  "REVALIDATE_SECRET",
];

const readEnv = (name) => {
  const file = path.join(SITE_DIR, name);
  return existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : null;
};

const prod = readEnv(".env.prod");
if (!prod?.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(
    "Нет apps/site/.env.prod с NEXT_PUBLIC_SUPABASE_URL — ключи прода, см. docs/prod-setup.md.",
  );
  process.exit(1);
}

const env = { ...process.env };
for (const key of Object.keys(readEnv(".env.local") ?? {})) env[key] = "";
Object.assign(env, prod);
for (const key of WRITE_KEYS) env[key] = "";
env.SITE_NOINDEX = "1";

const nextBin = createRequire(path.join(SITE_DIR, "package.json")).resolve("next/dist/bin/next");
console.log(
  `Копия прода: http://localhost:${PORT} — база ${new URL(prod.NEXT_PUBLIC_SUPABASE_URL).host}, только чтение.`,
);
const child = spawn(process.execPath, [nextBin, "dev", "--port", PORT], {
  cwd: SITE_DIR,
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
