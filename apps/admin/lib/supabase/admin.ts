import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv, supabaseSecretKey } from "./env";

/**
 * Клиент с секретным ключом: обходит RLS. Только сервер и только там, где нельзя иначе
 * (заявки с сайта, cron, создание пользователей руководителем).
 */
export function createSupabaseAdminClient() {
  const { url } = supabasePublicEnv();
  return createClient(url, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
