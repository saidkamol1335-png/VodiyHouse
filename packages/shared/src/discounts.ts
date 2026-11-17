// Скидки на сайте (правки 15.11, п. 4 + 21): спецпредложения могут называть скидку (PLAN §10 п. 51), но
// сайт показывает такие только когда руководитель включил «Показывать скидки» в «Витрина →
// Спецпредложения» — публичная запись settings `site.show_discounts`. Записи нет — выключено.
//
// «Скидка» в тексте — слово «скидка / skidka / chegirma / discount» или «−N%»: минус, тире (любое) или
// дефис перед числом с процентом не после цифры или «%», чтобы диапазон «10–30%» и «взнос 30%»
// проходили; пробел перед «%» — любой, включая неразрывный. Та же проверка в базе —
// private.mentions_discount (20261028150000_showcase.sql, 20261028230000_discount_percent.sql).
// Без lookbehind: модуль попадает в бандл кабинета (Safari < 16.4).

export const DISCOUNTS_KEY = "site.show_discounts";

export type DiscountSettings = { enabled: boolean };

export const DISCOUNTS_DEFAULT: DiscountSettings = { enabled: false };

/** Значение из базы (jsonb) → настройка; кривое — как по умолчанию (скидок на сайте нет). */
export function discountSettingsFrom(raw: unknown): DiscountSettings {
  if (!raw || typeof raw !== "object") return DISCOUNTS_DEFAULT;
  const { enabled } = raw as { enabled?: unknown };
  return typeof enabled === "boolean" ? { enabled } : DISCOUNTS_DEFAULT;
}

const DISCOUNT = /скидк|skidk|chegirma|discount|(?:^|[^\d%])[−—–-]\d+[\s  ]?%/i;

export function mentionsDiscount(text: string): boolean {
  return DISCOUNT.test(text);
}

/** Есть ли скидка хоть в одном языке текста { ru, uz } (null — текста нет). */
export function textsMentionDiscount(...texts: ({ ru: string; uz: string } | null | undefined)[]): boolean {
  return texts.some((value) => Boolean(value && (mentionsDiscount(value.ru) || mentionsDiscount(value.uz))));
}
