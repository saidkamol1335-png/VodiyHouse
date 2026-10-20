import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "./env";

/**
 * Клиент без cookie и без сохранения сессии: только проверить пароль (временный пароль на
 * /admin/parol). Сессия сотрудника в браузере от него не меняется.
 */
export function createSupabaseVerifierClient() {
  const { url, publishableKey } = supabasePublicEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
