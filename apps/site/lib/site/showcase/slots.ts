import type { ShowcaseAd } from "./records";

/**
 * Реклама в каталоге (правки 15.11, п. 4 + 13; уточнение 20.11 — «как на OLX»): первый баннер — над
 * списком ЖК, дальше — после каждой 6-й карточки во всю строку, по кругу в порядке руководителя со
 * второго. Шесть карточек — два ряда на ПК, три на планшете, шесть на телефоне: между двумя баннерами
 * всегда больше экрана, на экране не больше одного.
 */
export const AD_SLOT_EVERY = 6;

/** Баннер после карточки с этим индексом (с нуля); null — слота нет. */
export function adSlotAfter(index: number, ads: readonly ShowcaseAd[]): ShowcaseAd | null {
  if (ads.length === 0 || (index + 1) % AD_SLOT_EVERY !== 0) return null;
  return ads[((index + 1) / AD_SLOT_EVERY) % ads.length] ?? null;
}

/** Слот с этим индексом засчитывает показ: первый круг (ads[0] уже показан над списком). */
export const adSlotCounts = (index: number, ads: readonly ShowcaseAd[]) => (index + 1) / AD_SLOT_EVERY < ads.length;
