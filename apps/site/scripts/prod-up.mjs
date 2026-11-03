// Прод Проекта-1 на аккаунтах исполнителя одной командой (решение 02.11.2026, docs/prod-setup.md).
// Перед запуском человек входит в Supabase CLI: `npx supabase login` (Enter, подтвердить в браузере, код).
// Дальше: node scripts/prod-up.mjs — из apps/site. Шаги идут по порядку и пропускают сделанное:
//   1 проект Supabase vodiyhouse-prod (Франкфурт) → .env.prod (пароль базы и секреты — в файл ДО создания)
//   2 строка подключения (Session pooler)   3 настройки Auth по чек-листу   4 миграции   5 секрет в Vault
//   6 ЖК черновиками   7 переменные и сборка Netlify   8 cloud:check --prod
// Ни одно значение секрета не печатается — только ref, статусы и имена переменных. Журнал — prod-up.log.

import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SITE = path.join(import.meta.dirname, "..");
const ENV_PROD = path.join(SITE, ".env.prod");
const LOG = path.join(SITE, "prod-up.log");
const NAME = "vodiyhouse-prod";
const REGION = "eu-central-1";
const NETLIFY_SITE_ID = "b2eb9d23-b496-4208-89b7-7299bf48d46b"; // vodiyhouse-prod (создан 02.11)
const NETLIFY_SECRET_CONTEXTS = ["production", "deploy-preview", "branch-deploy"];
const SUPABASE_CLI = path.join(SITE, "..", "..", "node_modules", "supabase", "dist", "supabase.js");
const CLI_TIMEOUT = 180_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function log(line) {
  const text = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  console.log(text);
  fs.appendFileSync(LOG, `${text}\n`);
}

// --- .env.prod ---
function readEnv() {
  if (!fs.existsSync(ENV_PROD)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(ENV_PROD, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}
function writeEnv(env) {
  const body = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  fs.writeFileSync(
    ENV_PROD,
    `# Прод ${NAME}. Секреты — только здесь и в Netlify; в git не попадает (.env*).\n${body}\n`,
  );
}
/** Убирает из текста все значения .env.prod — для журнала и сообщений об ошибках. */
function mask(text, env) {
  let out = String(text ?? "");
  for (const value of Object.values(env))
    if (value && value.length >= 8) out = out.split(value).join("***");
  return out;
}

// --- Supabase CLI и Management API ---
function supabaseJson(args) {
  const out = execFileSync(process.execPath, [SUPABASE_CLI, ...args, "-o", "json"], {
    cwd: SITE,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: CLI_TIMEOUT,
  });
  // Перед JSON CLI иногда печатает уведомления — берём от первой скобки.
  return JSON.parse(out.slice(out.search(/[[{]/)));
}

/** Токен, который положил `supabase login`: переменная, файл или диспетчер учётных данных Windows. */
function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const file = path.join(
    process.env.USERPROFILE ?? process.env.HOME ?? "",
    ".supabase",
    "access-token",
  );
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  if (process.platform !== "win32") return null;
  const script = path.join(import.meta.dirname, "prod-token.ps1");
  try {
    const token = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 60_000,
      },
    ).trim();
    const plain = token.startsWith("go-keyring-base64:")
      ? Buffer.from(token.slice(18), "base64").toString("utf8")
      : token;
    return plain.startsWith("sbp_") ? plain : null;
  } catch {
    return null;
  }
}

async function management(token, method, url, body) {
  const response = await fetch(`https://api.supabase.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(
      `Management API ${method} ${url}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`,
    );
  return response.status === 204 ? null : response.json();
}

function alnum(length) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(length), (byte) => abc[byte % abc.length]).join("");
}
const refOf = (project) => project.ref ?? project.id;

/** Секреты, которых ещё нет. Только буквы и цифры: значение с «-» в начале CLI Netlify принял бы за ключ. */
function ensureSecrets(env) {
  env.SUPABASE_DB_PASSWORD ||= alnum(32);
  env.SITE_SIGNING_SECRET ||= alnum(64);
  env.CRON_SECRET ||= alnum(48);
  // Ключ AES-GCM Server Actions — ровно 32 байта в base64.
  env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString("base64");
  writeEnv(env);
  return env;
}

// --- шаги ---
async function createProject(token) {
  const env = ensureSecrets(readEnv()); // пароль базы — в файле ДО создания: не потеряется при сбое
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    log(`1 проект: уже есть (${env.NEXT_PUBLIC_SUPABASE_URL})`);
    return env;
  }
  const projects = supabaseJson(["projects", "list"]);
  const existing = projects.find((project) => project.name === NAME);
  if (existing) {
    // Прошлый запуск создал проект, но не дописал адрес — пароль в .env.prod тот же.
    env.NEXT_PUBLIC_SUPABASE_URL = `https://${refOf(existing)}.supabase.co`;
    writeEnv(env);
    log(`1 проект: найден ${NAME} (${refOf(existing)}) — продолжаю с паролем из .env.prod`);
    return env;
  }
  const testRef = fs
    .readFileSync(path.join(SITE, ".env.local"), "utf8")
    .match(/^NEXT_PUBLIC_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/m)?.[1]; // не пример из комментария
  const test = projects.find((project) => refOf(project) === testRef);
  if (!test) throw new Error("тестовый проект не найден в списке — не знаю организацию");
  const org = test.organization_slug ?? test.organization_id;
  if (token) {
    const plan = (await management(token, "GET", `/v1/organizations/${org}`).catch(() => null))
      ?.plan;
    if (plan && plan !== "pro" && plan !== "team" && plan !== "enterprise")
      throw new Error(`организация ${org} на тарифе ${plan}, а нужен Pro — проект не создаю`);
    log(`   организация ${org}, тариф ${plan ?? "не узнал"}`);
  }
  let created;
  try {
    created = supabaseJson([
      "projects",
      "create",
      NAME,
      "--org-id",
      org,
      "--db-password",
      env.SUPABASE_DB_PASSWORD,
      "--region",
      REGION,
      "--size",
      "micro",
    ]);
  } catch (error) {
    throw new Error(
      `projects create: ${mask(error.stderr ?? error.message, env).slice(0, 500)} — перед повтором проверить список проектов`,
    );
  }
  env.NEXT_PUBLIC_SUPABASE_URL = `https://${refOf(created)}.supabase.co`;
  writeEnv(env);
  log(`1 проект: создан ${NAME}, ref ${refOf(created)}, организация ${org}, регион ${REGION}`);
  return env;
}

async function waitHealthy(ref) {
  for (let attempt = 0; attempt < 80; attempt++) {
    let status = "?";
    try {
      status =
        supabaseJson(["projects", "list"]).find((item) => refOf(item) === ref)?.status ??
        "нет в списке";
    } catch (error) {
      status = `ошибка списка: ${String(error.message).slice(0, 80)}`;
    }
    if (status === "ACTIVE_HEALTHY") return log("   статус ACTIVE_HEALTHY");
    if (attempt % 4 === 0) log(`   статус ${status} — ждём`);
    await sleep(15_000);
  }
  throw new Error("проект не поднялся за 20 минут");
}

async function fillKeys(env, ref) {
  if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY) return env;
  let lastError = "";
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const keys = supabaseJson(["projects", "api-keys", "--project-ref", ref, "--reveal"]);
      const find = (prefix) =>
        keys
          .map((key) => key.api_key ?? "")
          .find((value) => value.startsWith(prefix) && !value.includes("•"));
      if (find("sb_publishable_") && find("sb_secret_")) {
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = find("sb_publishable_");
        env.SUPABASE_SECRET_KEY = find("sb_secret_");
        writeEnv(env);
        log("   ключи sb_publishable_ / sb_secret_ записаны в .env.prod");
        return env;
      }
      lastError = "в ответе нет sb_publishable_ / sb_secret_";
    } catch (error) {
      lastError = mask(error.stderr ?? error.message, env).slice(0, 200);
    }
    if (attempt === 0) log(`   ключей пока нет (${lastError}) — ждём`);
    await sleep(10_000);
  }
  throw new Error(`нет ключей: ${lastError} — Project Settings → API Keys`);
}

async function fillDbUrl(env, ref, token) {
  if (env.SUPABASE_DB_URL) return log("2 подключение: уже есть");
  if (!env.SUPABASE_DB_PASSWORD) throw new Error("в .env.prod нет SUPABASE_DB_PASSWORD");
  let hosts = [`aws-0-${REGION}.pooler.supabase.com`, `aws-1-${REGION}.pooler.supabase.com`];
  if (token) {
    try {
      const pooler = await management(token, "GET", `/v1/projects/${ref}/config/database/pooler`);
      const host = (Array.isArray(pooler) ? pooler : [pooler])
        .map((item) => item?.db_host)
        .find(Boolean);
      if (host) hosts = [host, ...hosts.filter((item) => item !== host)];
    } catch {}
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const host of hosts) {
      const url = `postgresql://postgres.${ref}:${env.SUPABASE_DB_PASSWORD}@${host}:5432/postgres`;
      const client = new pg.Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10_000,
      });
      try {
        await client.connect();
        await client.query("select 1");
        await client.end();
        env.SUPABASE_DB_URL = url;
        writeEnv(env);
        return log(`2 подключение: Session pooler ${host}`);
      } catch {
        await client.end().catch(() => {});
      }
    }
    if (attempt % 4 === 0) log("   пулер ещё не отвечает — ждём");
    await sleep(15_000);
  }
  throw new Error("пулер не отвечает 10 минут — Connect → Session pooler в панели");
}

async function configureAuth(ref, token) {
  if (!token)
    return log(
      "3 Auth: токена CLI не нашёл — настройки вручную по docs/prod-setup.md п. 2 (cloud:check покажет)",
    );
  await management(token, "PATCH", `/v1/projects/${ref}/config/auth`, {
    disable_signup: true,
    external_email_enabled: true,
    external_anonymous_users_enabled: false,
    mailer_autoconfirm: true,
    password_min_length: 10,
    security_update_password_require_reauthentication: false,
    security_sb_forwarded_for_enabled: true,
    password_hibp_enabled: true,
  });
  log(
    "3 Auth: регистрация закрыта, Confirm email выкл., анонимы выкл., пароль ≥ 10, Secure password change выкл., пересылка IP вкл., Leaked password protection вкл.",
  );
}

function runNode(script, args, env, label) {
  const result = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", script, ...args],
    {
      cwd: SITE,
      env: { ...process.env, ...env },
      encoding: "utf8",
      timeout: 1_800_000,
    },
  );
  const out = mask(`${result.stdout ?? ""}${result.stderr ?? ""}`, env);
  fs.appendFileSync(LOG, `--- ${label}\n${out}\n`);
  if (result.status !== 0) throw new Error(`${label}: код ${result.status}; вывод — prod-up.log`);
  return out;
}

function migrate(env) {
  // --yes: без вопроса «применить?»; строка подключения — аргументом, в журнал не пишется.
  const result = spawnSync(
    process.execPath,
    [SUPABASE_CLI, "db", "push", "--db-url", env.SUPABASE_DB_URL, "--yes"],
    {
      cwd: SITE,
      encoding: "utf8",
      timeout: 1_200_000,
    },
  );
  fs.appendFileSync(
    LOG,
    `--- db push\n${mask(`${result.stdout ?? ""}${result.stderr ?? ""}`, env)}\n`,
  );
  if (result.status !== 0) throw new Error(`db push: код ${result.status}; вывод — prod-up.log`);
  log("4 миграции применены");
}

function netlify(args, env) {
  const result = spawnSync("npx", ["netlify", ...args], {
    cwd: process.env.TEMP ?? SITE, // не в монорепо: иначе CLI спрашивает, какой проект
    shell: true,
    encoding: "utf8",
    timeout: CLI_TIMEOUT,
    env: { ...process.env, NETLIFY_SITE_ID },
  });
  if (result.status !== 0)
    throw new Error(
      `netlify ${args[0]}: код ${result.status}; ${mask(result.stderr, env).trim().split("\n").slice(-3).join(" ")}`,
    );
  return result.stdout;
}
const apiData = (data) => `"${JSON.stringify(data).replace(/"/g, '\\"')}"`;

async function netlifyDeploy(env) {
  const site = JSON.parse(
    netlify(["api", "getSite", "--data", apiData({ site_id: NETLIFY_SITE_ID })], env),
  );
  if (site.name !== NAME)
    throw new Error(`NETLIFY_SITE_ID указывает на «${site.name}», а не на ${NAME}`);
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SITE_SIGNING_SECRET",
    "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
    "CRON_SECRET",
  ];
  // Ключ Server Actions Next кладёт в .next открытым текстом (server-reference-manifest) — сканер
  // секретов Netlify остановил бы сборку; поэтому он обычная переменная, как на тестовом сайте.
  const notSecret = new Set([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
  ]);
  for (const key of vars) {
    if (!env[key]) throw new Error(`в .env.prod нет ${key}`);
    if (env[key].startsWith("-"))
      throw new Error(
        `${key} начинается с «-» — CLI Netlify примет его за ключ; пересоздать значение`,
      );
    netlify(
      [
        "env:set",
        key,
        `"${env[key]}"`,
        ...(notSecret.has(key) ? [] : ["--secret", "--context", ...NETLIFY_SECRET_CONTEXTS]),
      ],
      env,
    );
  }
  // Как у vodiyhouse-test: без плагина Next сайт выкладывается сырым .next (404 на всех страницах),
  // а вход команды Netlify — только для превью, иначе прод отдаёт 401.
  netlify(
    [
      "api",
      "updateSite",
      "--data",
      apiData({
        site_id: NETLIFY_SITE_ID,
        body: {
          plugins: [{ package: "@netlify/plugin-nextjs", pinned_version: "5" }],
          sso_login_context: "non_production",
        },
      }),
    ],
    env,
  );
  log(
    `7 Netlify (${site.name}): переменные ${vars.join(", ")} (+ SITE_NOINDEX=1, NODE_VERSION=24 заданы раньше), плагин Next, вход команды — только превью`,
  );
  const build = JSON.parse(
    netlify(
      [
        "api",
        "createSiteBuild",
        "--data",
        apiData({ site_id: NETLIFY_SITE_ID, body: { clear_cache: true } }),
      ],
      env,
    ),
  );
  log(`   сборка с очисткой кэша: ${build.deploy_id}`);
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(15_000);
    const deploy = JSON.parse(
      netlify(
        [
          "api",
          "getSiteDeploy",
          "--data",
          apiData({ site_id: NETLIFY_SITE_ID, deploy_id: build.deploy_id }),
        ],
        env,
      ),
    );
    if (deploy.state === "ready") return log(`   выложено: ${deploy.ssl_url ?? deploy.url}`);
    if (["error", "rejected", "skipped", "canceled", "cancelled"].includes(deploy.state))
      throw new Error(
        `сборка Netlify: ${deploy.state} ${deploy.error_message ?? ""} — лог: netlify logs -d ${build.deploy_id} -s deploy`,
      );
  }
  throw new Error("сборка Netlify дольше 20 минут");
}

async function main() {
  fs.appendFileSync(LOG, `\n=== prod-up ${new Date().toISOString()}\n`);
  const token = accessToken();
  log(`токен CLI: ${token ? "есть" : "нет"}`);
  let env = await createProject(token);
  const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\./)[1];
  await waitHealthy(ref);
  env = await fillKeys(env, ref);
  await fillDbUrl(env, ref, token);
  await configureAuth(ref, token);
  migrate(env);
  log(`5 ${runNode("scripts/vault-signing-secret.mjs", [], env, "vault").trim()}`);
  log(
    `6 ${runNode("scripts/realContent.mjs", ["--drafts"], env, "content:import --drafts").trim().split("\n").pop()}`,
  );
  await netlifyDeploy(env);
  const check = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/cloud-check.mjs", "--prod"],
    {
      cwd: SITE,
      env: { ...process.env, ...env, SUPABASE_ACCESS_TOKEN: token ?? "" },
      encoding: "utf8",
      timeout: CLI_TIMEOUT,
    },
  );
  log(
    `8 cloud:check --prod (код ${check.status}):\n${mask(`${check.stdout ?? ""}${check.stderr ?? ""}`, env)}`,
  );
  if (check.status !== 0) {
    process.exitCode = 1;
    return log("есть ✗ в cloud:check — разобрать по строкам выше (? — не ошибка)");
  }
  log(
    "готово. Дальше: docs/prod-check.md (обход сайта), Lighthouse, встреча — docs/handover-meeting.md",
  );
}

main().catch((error) => {
  log(`ОШИБКА: ${error.message}`);
  process.exit(1);
});
