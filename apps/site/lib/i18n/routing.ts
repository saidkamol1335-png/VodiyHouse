import { DEFAULT_LOCALE, LOCALES, type Locale } from "@vh/shared/locales";
import { defineRouting } from "next-intl/routing";

export { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@vh/shared/locales";

/** Кабинет и служебные страницы — только на русском (PLAN §4). */
export const ADMIN_LOCALE: Locale = "ru";
/** Выбор посетителя запоминается (ТЗ 1.5). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365 },
});

