// Языки сайта: общий список для сайта, админки и форматов (PLAN §10). Маршрутизация next-intl —
// в приложении сайта (apps/site/lib/i18n/routing.ts).
export const LOCALES = ["uz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
