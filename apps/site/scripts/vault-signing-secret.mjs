// Секрет подписи записей сайта — в Supabase Vault (site_signing_secret), тот же, что SITE_SIGNING_SECRET
// в Netlify: `node --env-file=.env.prod scripts/vault-signing-secret.mjs`. Значение не печатается.
// Повторный запуск заменяет секрет (после смены SITE_SIGNING_SECRET — передеплой сайта).

import pg from "pg";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";

const NAME = "site_signing_secret";
const secret = process.env.SITE_SIGNING_SECRET?.trim();
if (!process.env.SUPABASE_DB_URL || !secret || secret.length < 32) {
  console.error("Нужны SUPABASE_DB_URL и SITE_SIGNING_SECRET (от 32 знаков) — см. .env.example.");
  process.exit(1);
}

const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL));
await client.connect();
try {
  const { rows } = await client.query("select id from vault.secrets where name = $1", [NAME]);
  if (rows.length) await client.query("select vault.update_secret($1, $2)", [rows[0].id, secret]);
  else await client.query("select vault.create_secret($1, $2)", [secret, NAME]);
  console.log(`Vault: ${NAME} ${rows.length ? "заменён" : "записан"}.`);
} finally {
  await client.end();
}
