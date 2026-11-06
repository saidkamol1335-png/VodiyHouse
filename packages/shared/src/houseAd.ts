// Своя реклама Vodiy House на главной (06.11.2026): сайт собирает её из каталога, пока у застройщиков
// нет действующей рекламы. Руководитель выключает её в «Витрина → Реклама» — публичная запись settings
// `site.house_ad`. Записи нет — реклама включена (так было до выключателя).

export const HOUSE_AD_KEY = "site.house_ad";

export type HouseAdSettings = { enabled: boolean };

export const HOUSE_AD_DEFAULT: HouseAdSettings = { enabled: true };

/** Значение из базы (jsonb) → настройка; кривое — как по умолчанию (включена). */
export function houseAdSettingsFrom(raw: unknown): HouseAdSettings {
  if (!raw || typeof raw !== "object") return HOUSE_AD_DEFAULT;
  const { enabled } = raw as { enabled?: unknown };
  return typeof enabled === "boolean" ? { enabled } : HOUSE_AD_DEFAULT;
}
