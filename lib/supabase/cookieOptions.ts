// Параметры cookie сессии кабинета для всех трёх клиентов (сервер, proxy, браузер). Остальное —
// по умолчанию @supabase/ssr: путь /, SameSite=Lax, срок 400 дней (продлевается при каждом обновлении).
// Проверка безопасности 29.10: Secure — cookie с токенами не уходят по http. В разработке сайт на
// http://localhost, там флаг не ставим (WebKit не принимает Secure-cookie с http).

export function sessionCookieOptions(nodeEnv: string | undefined = process.env.NODE_ENV): { secure: boolean } {
  return { secure: nodeEnv === "production" };
}
