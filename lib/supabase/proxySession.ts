import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authForwardingOption, clientIpFrom } from "./authForwarding";
import { supabasePublicEnv } from "./env";

// Без server-only: модуль тестируется с подменой @supabase/ssr (proxySession.test.ts).

export type AdminSessionRefresh = {
  response: NextResponse;
  /** В cookie есть действующая сессия (подпись токена проверена getClaims). */
  hasSession: boolean;
  /** Auth не ответил (сеть) — не повод выкидывать на вход. */
  transient: boolean;
};

const SESSION_HEADERS = ["cache-control", "expires", "pragma"] as const;

/**
 * Обновляет cookie сессии кабинета по схеме @supabase/ssr: новые токены — и в запросе
 * (их прочитает страница), и в ответе (их сохранит браузер) с заголовками «не кэшировать».
 */
export async function refreshAdminSession(request: NextRequest): Promise<AdminSessionRefresh> {
  const { url, publishableKey } = supabasePublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    ...authForwardingOption(clientIpFrom(request.headers)),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  // Между созданием клиента и getClaims() — ничего: иначе обновлённый токен теряется.
  const { data, error } = await supabase.auth.getClaims();
  return {
    response,
    hasSession: Boolean(data?.claims?.sub),
    transient: error?.name === "AuthRetryableFetchError",
  };
}

/** Редирект не должен терять обновлённый или очищенный токен и заголовки «не кэшировать». */
export function copySessionCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  for (const name of SESSION_HEADERS) {
    const value = from.headers.get(name);
    if (value) to.headers.set(name, value);
  }
  return to;
}
