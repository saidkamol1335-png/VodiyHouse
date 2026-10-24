// Курс ЦБ в базу (фаза 2): `npm run rate:update`. Пока нет деплоя и расписания Netlify — вручную
// или из планировщика ОС. Строка подключения — SUPABASE_DB_URL из .env.local (см. .env.example).

import pg from "pg";
import { fetchCbuUsdRate } from "../lib/rates/cbu.ts";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Нет SUPABASE_DB_URL в .env.local — строка подключения к базе, см. .env.example.");
  process.exit(1);
}

const rate = await fetchCbuUsdRate();
const client = new pg.Client(dbClientConfig(connectionString));
await client.connect();
try {
  const { rows } = await client.query("select public.set_cbu_exchange_rate($1, $2) as changed", [
    rate.usdUzs,
    rate.date,
  ]);
  const state = rows[0].changed ? "записан" : "не изменился";
  console.log(`Курс ЦБ на ${rate.date}: 1 $ = ${rate.usdUzs} сум — ${state}.`);
} finally {
  await client.end();
}
