// Первый руководитель кабинета (регистрации нет — PLAN §3.3) и аварийный сброс его пароля.
//   npm run staff:create-head -- --email boss@vodiyhouse.uz --name "Имя Фамилия"
//   npm run staff:create-head -- --reset-password --email boss@vodiyhouse.uz
//   … --dry-run — только проверить аргументы и показать план, без обращения к Supabase.
// Если активный руководитель уже есть — отказ (второго добавляют в «Настройки → Сотрудники»),
// разве что явно --allow-second-head. Пароль печатается один раз; при первом входе — свой.
// Ключи — NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SECRET_KEY из .env.local.

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
// Тот же генератор, что у кабинета: Node 24 читает .ts сам (в файле нет импортов и TS-only синтаксиса).
import { generatePassword } from "../lib/admin/password.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 80;
const USERS_PAGE = 200;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readArguments() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      "reset-password": { type: "boolean", default: false },
      "allow-second-head": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const email = (values.email ?? "").trim().toLowerCase();
  const name = (values.name ?? "").trim().replace(/\s+/g, " ");
  const reset = values["reset-password"];
  if (!EMAIL.test(email)) fail("Нужен --email руководителя, например --email boss@vodiyhouse.uz");
  if (!reset && (name.length === 0 || name.length > NAME_MAX)) fail(`Нужно --name "Имя Фамилия" (1–${NAME_MAX} символов).`);
  return { email, name, reset, allowSecond: values["allow-second-head"], dryRun: values["dry-run"] };
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) fail("Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SECRET_KEY в .env.local — см. .env.example.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function printPassword(email, password) {
  console.log(`\nEmail: ${email}\nВременный пароль: ${password}\nВход: <адрес сайта>/admin/vhod`);
  console.log("Пароль показан один раз. При первом входе руководитель задаст свой (/admin/parol).");
}

async function createHead(admin, { email, name, allowSecond }) {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "head")
    .eq("is_active", true);
  if (error) fail(`Не удалось проверить руководителей: ${error.message}. Миграции применены (npm run db:push)?`);
  if (count > 0 && !allowSecond) {
    fail("Активный руководитель уже есть — второго добавьте в «Настройки → Сотрудники» (или --allow-second-head).");
  }

  const password = generatePassword();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) fail(`Auth не создал пользователя: ${created.error?.code ?? "без кода"}.`);
  const id = created.data.user.id;

  // Профиль — сервером: флаг смены пароля по умолчанию true, активен.
  const inserted = await admin.from("profiles").insert({ id, full_name: name, role: "head" });
  if (inserted.error) {
    await admin.auth.admin.deleteUser(id);
    fail(`Профиль не создан, пользователь Auth удалён: ${inserted.error.message}`);
  }
  console.log(`Руководитель создан: ${name}`);
  printPassword(email, password);
}

async function findUserId(admin, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PAGE });
    if (error) fail(`Не удалось прочитать пользователей Auth: ${error.code ?? error.message}`);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < USERS_PAGE) return null;
  }
}

async function resetHeadPassword(admin, { email }) {
  const id = await findUserId(admin, email);
  if (!id) fail(`Пользователя ${email} в Auth нет.`);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
  if (profile?.role !== "head") fail(`${email} — не руководитель. Пароль сотрудника меняют в «Настройки → Сотрудники».`);

  const flagged = await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
  if (flagged.error) fail(`Не удалось отметить смену пароля: ${flagged.error.message}`);
  const password = generatePassword();
  // Заодно снимаем бан: аварийный вход должен сработать.
  const updated = await admin.auth.admin.updateUserById(id, { password, ban_duration: "none" });
  if (updated.error) fail(`Auth не сменил пароль: ${updated.error.code ?? updated.error.message}`);
  console.log(`Новый временный пароль руководителя ${email}`);
  printPassword(email, password);
}

const options = readArguments();
if (options.dryRun) {
  const plan = options.reset
    ? `сбросить пароль руководителя ${options.email} (флаг смены пароля, снять бан)`
    : `создать руководителя «${options.name}» <${options.email}>${options.allowSecond ? " (разрешён второй)" : ""}`;
  console.log(`Пробный запуск, без обращения к Supabase. План: ${plan}.`);
  console.log(`Генератор пароля загружен: ${generatePassword().length} символов.`);
} else {
  const admin = adminClient();
  await (options.reset ? resetHeadPassword(admin, options) : createHead(admin, options));
}
