import { NextResponse, type NextRequest } from "next/server";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { adminGate, hasAuthCookie, isAdminPath, type GateDecision } from "@/lib/admin/gate";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { RETURN_COOKIE, RETURN_MAX_AGE_SECONDS, safeReturnPath } from "@/lib/admin/returnPath";
import { staffCookie } from "@/lib/admin/staffCookie";
import { contentSecurityPolicy, createNonce, NONCE_HEADER } from "@/lib/securityHeaders";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { STAFF_COOKIE } from "@vh/shared/staffCookie";
import { copySessionCookies, refreshAdminSession } from "@/lib/supabase/proxySession";

// Кабинет admin.vodiyhouse.uz (PLAN §10): весь домен — кабинет, кроме стендов /dev и /api.
// Языков и предпросмотра сайта здесь нет — они в apps/site.
const LOGIN_PATH = ADMIN_ROUTES.login;
const ACTION_HEADER = "next-action";
const CSP_HEADER = "content-security-policy";

/**
 * CSP со своим nonce на каждый ответ (фаза F, п. 45). Nonce и политика пишутся прямо в заголовки
 * запроса, а дальше везде NextResponse.next({ request }): Next берёт nonce из CSP запроса для своих
 * скриптов, layout — из x-nonce для скрипта в <head>. Копию заголовков до обновления сессии делать
 * нельзя — страница получила бы старый токен (refreshAdminSession пишет новый в этот же запрос).
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const policy = contentSecurityPolicy({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV === "development",
    nonce,
  });
  request.headers.set(NONCE_HEADER, nonce);
  request.headers.set(CSP_HEADER, policy);
  const response = isAdminPath(request.nextUrl.pathname) ? await cabinetProxy(request) : NextResponse.next({ request });
  response.headers.set(CSP_HEADER, policy);
  return response;
}

// Проверка здесь только оптимистичная (docs: authentication.md, «Optimistic checks with Proxy»):
// права решают страницы кабинета (lib/admin/session.ts) и база. Ранний редирект нужен ради
// настоящего 307: оболочка /admin статичная и уходит сразу, и редирект из раздела пришёл бы потоком.
async function cabinetProxy(request: NextRequest) {
  if (isCabinetOpenWithoutLogin) return NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isServerAction = request.headers.has(ACTION_HEADER);

  // Экран входа статичный — без клиента и Set-Cookie; без cookie сессии (или без ключей
  // в продакшене) — без запроса к Auth.
  const withCookie = hasSupabaseEnv() && hasAuthCookie(request.cookies.getAll().map(({ name }) => name));
  if (pathname === LOGIN_PATH || !withCookie) {
    return gateResponse(request, adminGate({ pathname, hasSession: false, isServerAction }), NextResponse.next({ request }));
  }

  const session = await refreshAdminSession(request);
  // Вошёл до фазы F или метку стёрли — помечаем браузер сотрудника для сайта (п. 40); вход ставит её сам.
  if (session.hasSession && !request.cookies.has(STAFF_COOKIE))
    session.response.cookies.set(staffCookie(request.nextUrl.hostname, request.nextUrl.protocol === "https:"));
  // Сбой сети Auth — не повод выкидывать на вход: кабинет сам покажет «временно недоступен».
  const hasSession = session.hasSession || session.transient;
  return gateResponse(request, adminGate({ pathname, hasSession, isServerAction }), session.response);
}

function gateResponse(request: NextRequest, decision: GateDecision, response: NextResponse) {
  if (decision.kind === "next") return response;
  const redirect = copySessionCookies(response, NextResponse.redirect(new URL(decision.location, request.url)));
  // Ссылка кабинета без сессии (заявка из чата менеджеров) — после входа вернуться к ней. Только
  // переход страницы: предзагрузка Link, запросы RSC и файлы (CSV) адрес возврата не меняют.
  const back = safeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (decision.location === LOGIN_PATH && back && back !== ADMIN_ROUTES.home && isPageNavigation(request)) {
    redirect.cookies.set(RETURN_COOKIE, back, {
      maxAge: RETURN_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  return redirect;
}

export const config = {
  // Статика и картинки Next.js мимо proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

const FILE_ROUTE = /\/csv$/;

function isPageNavigation(request: NextRequest): boolean {
  const { headers } = request;
  if (headers.has("rsc") || headers.has("next-router-prefetch") || FILE_ROUTE.test(request.nextUrl.pathname)) return false;
  // Старые браузеры без Sec-Fetch-* — как переход страницы.
  const destination = headers.get("sec-fetch-dest");
  return destination === null || destination === "document";
}
