// Куда отправить запрос без языка в адресе. Чистая функция — проверяется тестами,
// proxy.ts только применяет результат.

import { DEFAULT_LOCALE, isLocale, type Locale } from "./routing";

/** Разделы без языкового префикса: кабинет, служебные страницы, API, файлы Next.js. */
const UNPREFIXED_SECTIONS = ["admin", "dev", "api", "_next", "_vercel"];

export function localeOfPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return isLocale(first) ? first : null;
}

function isUnprefixedSection(pathname: string): boolean {
  const first = pathname.split("/")[1] ?? "";
  return UNPREFIXED_SECTIONS.includes(first) || first.includes(".");
}

/**
 * null — запрос не трогаем; иначе — адрес для редиректа.
 * Язык браузера (Accept-Language) не учитываем: по умолчанию узбекский, дальше — выбор посетителя (ТЗ 1.5).
 */
export function localeRedirectTarget(pathname: string, cookieLocale: string | undefined): string | null {
  if (localeOfPath(pathname) || isUnprefixedSection(pathname)) return null;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}
