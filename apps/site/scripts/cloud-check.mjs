// Готово ли облако: `npm run cloud:check`. Перед шагом 7 и после правок в панели Supabase.
// Проверяет ключи .env.local (значения не печатает), открытые настройки Auth и JWT-ключи,
// секретный ключ (одна строка списка пользователей), базу: миграции, DEMO, первый руководитель.
// Закрытые настройки (длина пароля, Secure password change, пересылка IP) видны только через
// Management API: токен Account → Access Tokens — на один запуск, в .env.local не сохранять:
//   PowerShell: $env:SUPABASE_ACCESS_TOKEN = "sbp_…"; npm run cloud:check
// Код выхода 1 — есть ✗.
// Прод: `node --env-file=.env.prod scripts/cloud-check.mjs --prod` — DEMO, сотрудники e2e и неполные
// опубликованные ЖК — ✗, заявки и счётчик — ? (только чтение, решение 02.11).

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import {
  checkAuthConfig,
  checkAuthSettings,
  checkDatabase,
  checkEnv,
  checkJwks,
  manualAuthConfig,
  projectRefFromUrl,
} from "../lib/supabase/cloudCheck.ts";
import { checkProd } from "../lib/supabase/prodCheck.ts";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";
import { editedMigrations } from "../lib/supabase/migrationDrift.ts";

const TIMEOUT_MS = 10_000;
const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "..", "..", "supabase", "migrations");
const MARK = { ok: "✓", fail: "✗", manual: "?" };
const env = process.env;
const PROD = process.argv.includes("--prod");
let failed = false;

function print(title, lines) {
  console.log(`\n${title}`);
  for (const { status, text, hint } of lines) {
    if (status === "fail") failed = true;
    console.log(`  ${MARK[status]} ${text}${hint ? ` — ${hint}` : ""}`);
  }
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function authLines(url, publishableKey) {
  const headers = { apikey: publishableKey };
  try {
    const settings = await getJson(`${url}/auth/v1/settings`, headers);
    const jwks = await getJson(`${url}/auth/v1/.well-known/jwks.json`, headers);
    return [...checkAuthSettings(settings), checkJwks(jwks)];
  } catch (error) {
    return [
      {
        status: "fail",
        text: `Auth не ответил (${error.message})`,
        hint: "адрес проекта или публичный ключ",
      },
    ];
  }
}

async function secretKeyLine(url, secretKey) {
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error)
    return {
      status: "fail",
      text: `секретный ключ не подошёл (${error.status ? `HTTP ${error.status}` : error.message})`,
    };
  return { status: "ok", text: "секретный ключ принят Auth" };
}

async function managementLines(ref) {
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token || !ref) return manualAuthConfig();
  try {
    const config = await getJson(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
      Authorization: `Bearer ${token}`,
    });
    return checkAuthConfig(config);
  } catch (error) {
    return [
      { status: "fail", text: `Management API не ответил (${error.message})` },
      ...manualAuthConfig(),
    ];
  }
}

async function countOrNull(client, sql) {
  try {
    const { rows } = await client.query(sql);
    return rows[0].count;
  } catch {
    return null; // Таблиц ещё нет — до db:push.
  }
}

async function databaseLines(connectionString) {
  const files = new Map();
  for (const file of (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith(".sql"))) {
    files.set(file.split("_")[0], await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  const client = new pg.Client({
    ...dbClientConfig(connectionString),
    connectionTimeoutMillis: TIMEOUT_MS,
  });
  try {
    await client.connect();
  } catch (error) {
    return [
      {
        status: "fail",
        text: `база не ответила (${error.message})`,
        hint: "SUPABASE_DB_URL: пароль базы, Session pooler",
      },
    ];
  }
  try {
    const migrations = await client
      .query("select version, statements from supabase_migrations.schema_migrations")
      .then(
        ({ rows }) => rows,
        () => [],
      );
    const demoComplexes = await countOrNull(
      client,
      "select count(*)::int as count from public.complexes where slug like 'demo-%'",
    );
    const activeHeads = await countOrNull(
      client,
      "select count(*)::int as count from public.profiles where role = 'head' and is_active",
    );
    const lines = checkDatabase(
      {
        applied: migrations.map((row) => row.version),
        local: [...files.keys()],
        edited: editedMigrations(migrations, files),
        demoComplexes,
        activeHeads,
      },
      PROD,
    );
    if (!PROD) return lines;
    const rows = async (sql) =>
      client.query(sql).then(
        ({ rows }) => rows,
        () => null,
      );
    const incomplete = await rows(
      "select slug from public.complexes where status = 'published' and site_state = 'draft' order by slug",
    );
    const rate = await rows("select private.exchange_rate() as rate");
    // Счётчик identity не откатывается удалением заявок — читаем саму последовательность.
    const seq = await rows("select pg_get_serial_sequence('public.leads', 'number') as name");
    const next = seq?.[0]?.name
      ? await rows(
          `select (case when is_called then last_value + 1 else last_value end)::int as count from ${seq[0].name}`,
        )
      : null;
    return [
      ...lines,
      ...checkProd({
        demoComplexes,
        e2eUsers: await countOrNull(
          client,
          "select count(*)::int as count from auth.users where email like 'e2e-%@example.com'",
        ),
        leads: await countOrNull(client, "select count(*)::int as count from public.leads"),
        nextLeadNumber: next?.[0]?.count ?? null,
        incompletePublished: incomplete?.map((row) => row.slug) ?? null,
        rate: rate ? rate[0].rate !== null : null,
      }),
    ];
  } finally {
    await client.end();
  }
}

const envLines = checkEnv(env, PROD);
print(PROD ? "Ключи (прод):" : "Ключи (.env.local):", envLines);

const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const ref = projectRefFromUrl(url);
if (ref && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  const auth = await authLines(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (env.SUPABASE_SECRET_KEY) auth.push(await secretKeyLine(url, env.SUPABASE_SECRET_KEY));
  print("Настройки Auth:", [...auth, ...(await managementLines(ref))]);
} else {
  console.log("\nНастройки Auth: пропущено — нет адреса проекта или публичного ключа.");
}

if (env.SUPABASE_DB_URL) print("База:", await databaseLines(env.SUPABASE_DB_URL));
else console.log("\nБаза: пропущено — нет SUPABASE_DB_URL.");

console.log(
  failed
    ? "\nЕсть ✗ — облако не готово. ? — проверь в панели Supabase."
    : "\nОблако готово. ? — проверь в панели Supabase.",
);
process.exit(failed ? 1 : 0);
