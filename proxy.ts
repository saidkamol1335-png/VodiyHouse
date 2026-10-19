import { NextResponse, type NextRequest } from "next/server";
import { localeOfPath, localeRedirectTarget } from "@/lib/i18n/localeRedirect";
import { LOCALE_COOKIE } from "@/lib/i18n/routing";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Next.js 16: бывший middleware. Только язык: редирект на /uz или /ru и запоминание выбора.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = localeRedirectTarget(pathname, request.cookies.get(LOCALE_COOKIE)?.value);
  if (target) {
    return NextResponse.redirect(new URL(`${target}${search}`, request.url));
  }

  const locale = localeOfPath(pathname);
  const response = NextResponse.next();
  if (locale && request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR_SECONDS, sameSite: "lax", path: "/" });
  }
  return response;
}

export const config = {
  // Статика и картинки Next.js мимо proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
