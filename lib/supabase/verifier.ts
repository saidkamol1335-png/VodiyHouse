import "server-only";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { authForwardingOption, clientIpFrom } from "./authForwarding";
import { supabasePublicEnv } from "./env";

/**
 * Клиент без cookie и без сохранения сессии: только проверить пароль (временный пароль на
 * /admin/parol). Сессия сотрудника в браузере от него не меняется.
 */
export async function createSupabaseVerifierClient() {
  const { url, publishableKey } = supabasePublicEnv();
  return createClient(url, publishableKey, {
    ...authForwardingOption(clientIpFrom(await headers())),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
