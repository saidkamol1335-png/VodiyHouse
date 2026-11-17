import type { ShowcaseAd } from "./records";

/**
 * Слот рекламы в каталоге (правки 15.11, п. 4 + 13): после каждой 6-й карточки — баннер во всю строку,
 * баннеры по кругу в порядке руководителя. Шесть карточек — два ряда на ПК, три на планшете, шесть на
 * телефоне: между двумя баннерами всегда больше экрана, на экране не больше одного.
 */
export const AD_SLOT_EVERY = 6;

/** Баннер после карточки с этим индексом (с нуля); null — слота нет. */
export function adSlotAfter(index: number, ads: readonly ShowcaseAd[]): ShowcaseAd | null {
  if (ads.length === 0 || (index + 1) % AD_SLOT_EVERY !== 0) return null;
  return ads[((index + 1) / AD_SLOT_EVERY - 1) % ads.length] ?? null;
}
