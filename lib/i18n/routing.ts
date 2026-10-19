import { defineRouting } from "next-intl/routing";

export const LOCALES = ["uz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";
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

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
