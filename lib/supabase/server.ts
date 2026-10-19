import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

/**
 * Клиент для Server Components, Server Actions и Route Handlers: сессия сотрудника из cookie.
 * cookies() делает страницу динамической — на публичных статичных страницах не вызывать.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = supabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
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
