import { NextResponse, type NextRequest } from "next/server";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { adminGate, hasAuthCookie, isAdminPath, type GateDecision } from "@/lib/admin/gate";
import { localeOfPath, localeRedirectTarget } from "@/lib/i18n/localeRedirect";
import { LOCALE_COOKIE } from "@/lib/i18n/routing";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { copySessionCookies, refreshAdminSession } from "@/lib/supabase/proxySession";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const LOGIN_PATH = "/admin/vhod";
// Server Action — POST на адрес страницы с этим заголовком (next/dist/client/components/app-router-headers.js).
const ACTION_HEADER = "next-action";

// Next.js 16: бывший middleware. Кабинет — обновление сессии Supabase и ранний редирект на вход;
// сайт — язык: редирект на /uz или /ru и запоминание выбора.
export async function proxy(request: NextRequest) {
  if (isAdminPath(request.nextUrl.pathname)) return cabinetProxy(request);
  return localeProxy(request);
}

// Кука предпросмотра (draftMode, шаг 3.6): страница ЖК читает базу сессией руководителя.
const PREVIEW_COOKIE = "__prerender_bypass";

/**
 * Предпросмотр: сессию обновляет proxy, как в кабинете. Иначе истёкший токен обновила бы сама
 * страница, а записать куки она не может — браузер остался бы со старым токеном, и следующий
 * заход в кабинет отозвал бы сессию («Already Used»).
 */
// Только страница ЖК (и её Server Action — POST на тот же адрес) читает базу сессией в предпросмотре.
const COMPLEX_PAGE = /^\/(?:uz|ru)\/novostroyki\/[a-z0-9-]+$/;

async function previewResponse(request: NextRequest): Promise<NextResponse> {
  const names = request.cookies.getAll().map(({ name }) => name);
  if (!COMPLEX_PAGE.test(request.nextUrl.pathname)) return NextResponse.next();
  if (!hasSupabaseEnv() || !names.includes(PREVIEW_COOKIE) || !hasAuthCookie(names)) return NextResponse.next();
  return (await refreshAdminSession(request)).response;
}

async function localeProxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = localeRedirectTarget(pathname, request.cookies.get(LOCALE_COOKIE)?.value);
  if (target) {
    return NextResponse.redirect(new URL(`${target}${search}`, request.url));
  }

  const locale = localeOfPath(pathname);
  const response = await previewResponse(request);
  if (locale && request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR_SECONDS, sameSite: "lax", path: "/" });
  }
  return response;
}

// Проверка здесь только оптимистичная (docs: authentication.md, «Optimistic checks with Proxy»):
// права решают страницы кабинета (lib/admin/session.ts) и база. Ранний редирект нужен ради
// настоящего 307: оболочка /admin статичная и уходит сразу, и редирект из раздела пришёл бы потоком.
async function cabinetProxy(request: NextRequest) {
  if (isCabinetOpenWithoutLogin) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const isServerAction = request.headers.has(ACTION_HEADER);

  // Экран входа статичный — без клиента и Set-Cookie; без cookie сессии (или без ключей
  // в продакшене) — без запроса к Auth.
  const withCookie = hasSupabaseEnv() && hasAuthCookie(request.cookies.getAll().map(({ name }) => name));
  if (pathname === LOGIN_PATH || !withCookie) {
    return gateResponse(request, adminGate({ pathname, hasSession: false, isServerAction }), NextResponse.next());
  }

  const session = await refreshAdminSession(request);
  // Сбой сети Auth — не повод выкидывать на вход: кабинет сам покажет «временно недоступен».
  const hasSession = session.hasSession || session.transient;
  return gateResponse(request, adminGate({ pathname, hasSession, isServerAction }), session.response);
}

function gateResponse(request: NextRequest, decision: GateDecision, response: NextResponse) {
  if (decision.kind === "next") return response;
  return copySessionCookies(response, NextResponse.redirect(new URL(decision.location, request.url)));
}

export const config = {
  // Статика и картинки Next.js мимо proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
