import { NextResponse, type NextRequest } from "next/server";
import { localeOfPath, localeRedirectTarget } from "@/lib/i18n/localeRedirect";
import { LOCALE_COOKIE } from "@/lib/i18n/routing";
import { hasAdParams, LANDING_COOKIE, LANDING_MAX_AGE, landingValue } from "@/lib/leads/landing";
import { PREVIEW_COOKIE } from "@/lib/supabase/preview";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Next.js 16: бывший middleware. Сайт — язык (редирект на /uz или /ru и запоминание выбора) и
// рекламные метки. Кабинета здесь нет (PLAN §10): он — отдельное приложение на своём домене.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = localeRedirectTarget(pathname, request.cookies.get(LOCALE_COOKIE)?.value);
  if (target) {
    return NextResponse.redirect(new URL(`${target}${search}`, request.url));
  }

  const response = NextResponse.next();
  const locale = localeOfPath(pathname);
  if (locale && request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR_SECONDS, sameSite: "lax", path: "/" });
  }
  // Предпросмотр по гранту кабинета (PLAN §10): такие страницы не индексируются.
  if (request.cookies.has(PREVIEW_COOKIE)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  rememberAdLanding(request, response);
  return response;
}

/** Страница ЖК: только ей нужна рекламная cookie (3.13). */
const COMPLEX_PAGE = /^\/(?:uz|ru)\/novostroyki\/[a-z0-9-]+$/;

/**
 * Заход на страницу ЖК с рекламными метками: адрес — в cookie на минуту. Если ЖК уже снят с сайта,
 * страница ответит редиректом на каталог без параметров, а метки заявка возьмёт отсюда (3.13).
 */
function rememberAdLanding(request: NextRequest, response: NextResponse): void {
  const { pathname, search, searchParams } = request.nextUrl;
  if (request.method !== "GET" || !COMPLEX_PAGE.test(pathname) || !hasAdParams(searchParams)) return;
  const value = landingValue(pathname, search);
  // Значение кодирует сам Next (encodeURIComponent при записи заголовка) — второй раз не кодируем.
  if (value) response.cookies.set(LANDING_COOKIE, value, { maxAge: LANDING_MAX_AGE, sameSite: "lax", path: "/" });
}

export const config = {
  // Статика и картинки Next.js мимо proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
