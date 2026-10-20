import { createClient } from "@supabase/supabase-js";
import { assertE2eProject, E2E_EMAIL, hasCloud } from "./cloud";

// После прогона против облака: удалить всех e2e-…@example.com, в том числе оставшихся от
// упавших прогонов. Профиль удаляется каскадом; журнал (audit_log) не трогаем никогда.
const PAGE_SIZE = 200;

export default async function globalTeardown(): Promise<void> {
  if (!hasCloud || !process.env.SUPABASE_SECRET_KEY) return;
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
}
