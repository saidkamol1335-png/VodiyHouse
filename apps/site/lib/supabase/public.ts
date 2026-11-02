import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "./env";

/**
 * Клиент публичных страниц: роль anon, без cookie и сессии — его можно звать внутри 'use cache'
 * (статичная страница не становится динамической). Читает только то, что отдают функции для
 * посетителя (site_calc_screen и др.).
 */
export function createSupabasePublicClient() {
  const { url, publishableKey } = supabasePublicEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
