import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { assertE2eProject, E2E_EMAIL, hasCloud } from "./cloud";

// После прогона против облака: удалить всех e2e-…@example.com, в том числе оставшихся от
// упавших прогонов. Профиль удаляется каскадом; журнал (audit_log) не трогаем никогда.
const PAGE_SIZE = 200;

export default async function globalTeardown(): Promise<void> {
  if (!hasCloud) return;
  const { url, secret } = assertE2eProject();
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const doomed: string[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`Список пользователей Auth: ${error.code}`);
    doomed.push(...data.users.filter((user) => E2E_EMAIL.test(user.email ?? "")).map((user) => user.id));
    if (data.users.length < PAGE_SIZE) break;
  }
  for (const id of doomed) await admin.auth.admin.deleteUser(id);
  await removeE2eLeads();
}

/**
 * Заявки e2e (имя «E2E …», leads.spec.ts) и их снимки расчётов. У сервера прав на таблицу заявок нет
 * (только функции) — удаляем владельцем базы по SUPABASE_DB_URL; без адреса базы — остаются.
 */
async function removeE2eLeads(): Promise<void> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) return;
  const client = new pg.Client(dbClientConfig(url));
  await client.connect();
  try {
    await client.query(
      `with doomed as (select id from public.leads where name like 'E2E %')
       , calc as (delete from public.calculations where lead_id in (select id from doomed))
       delete from public.leads where id in (select id from doomed)`,
    );
  } finally {
    await client.end();
  }
}
