// Сброс второго фактора руководителя (PLAN §10, п. 28): потерян Telegram и запасные коды.
//   npm run staff:reset-2fa -- --email boss@vodiyhouse.uz
// Удаляет TOTP-факторы в Supabase Auth, привязку Telegram, коды и закрывает все сессии сотрудника:
// при следующем входе он заново привяжет Telegram и получит новые запасные коды.
// Ключи — NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SECRET_KEY из .env.local.

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERS_PAGE = 200;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({ options: { email: { type: "string" } } });
const email = (values.email ?? "").trim().toLowerCase();
if (!EMAIL.test(email)) fail("Нужен --email сотрудника, например --email boss@vodiyhouse.uz");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) fail("Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SECRET_KEY в .env.local — см. .env.example.");
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser() {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PAGE });
    if (error) fail(`Auth не ответил: ${error.message}`);
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < USERS_PAGE) return null;
  }
}

const user = await findUser();
if (!user) fail(`Сотрудника ${email} нет в Auth.`);

const factors = await admin.auth.admin.mfa.listFactors({ userId: user.id });
if (factors.error) fail(`Факторы не прочитаны: ${factors.error.message}`);
for (const factor of factors.data.factors) {
  const removed = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
  if (removed.error) fail(`Фактор ${factor.id} не удалён: ${removed.error.message}`);
}
const reset = await admin.rpc("reset_head_second_factor", { p_user: user.id });
if (reset.error) fail(`Привязка не сброшена: ${reset.error.message}`);
console.log(`Готово: второй фактор ${email} сброшен (факторов удалено: ${factors.data.factors.length}).`);
