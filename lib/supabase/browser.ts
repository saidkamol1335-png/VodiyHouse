"use client";

import { createBrowserClient } from "@supabase/ssr";
import { sessionCookieOptions } from "./cookieOptions";
import { supabasePublicEnv } from "./env";

/** Клиент для браузера: публичный ключ, права — по RLS и сессии пользователя. */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = supabasePublicEnv();
  return createBrowserClient(url, publishableKey, { cookieOptions: sessionCookieOptions() });
}
