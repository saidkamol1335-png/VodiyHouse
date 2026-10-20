import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { authForwardingOption, clientIpFrom } from "./authForwarding";
import { supabasePublicEnv } from "./env";

/**
 * Клиент для Server Components, Server Actions и Route Handlers: сессия сотрудника из cookie.
 * cookies() делает страницу динамической — на публичных статичных страницах не вызывать.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = supabasePublicEnv();
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return createServerClient(url, publishableKey, {
    ...authForwardingOption(clientIpFrom(headerStore)),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Из Server Component cookie не записать — сессию обновит следующий запрос через proxy.
        }
      },
    },
  });
}
