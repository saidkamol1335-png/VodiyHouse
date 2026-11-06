import type { BilingualValue } from "./bilingual";

// Названия подборок без скидок (PLAN §3.13; с 06.11.2026 спецпредложения и реклама скидки называть
// могут — PLAN §10 п. 51, allowDiscount в showcase/forms.ts): они не пропускают слово «скидка /
// skidka / chegirma / discount» и «−N%» — минус, тире (любое) или дефис перед числом с процентом не после цифры или «%», чтобы диапазон «10–30%» и «взнос 30%»
// проходили; пробел перед «%» — любой, включая неразрывный. Та же проверка в базе —
// private.mentions_discount (миграции 20261028150000_showcase.sql, 20261028230000_discount_percent.sql),
// чтобы обойти форму было нельзя. Без lookbehind: модуль попадает в бандл кабинета (Safari < 16.4).

const DISCOUNT = /скидк|skidk|chegirma|discount|(?:^|[^\d%])[−—–-]\d+[\s\u00a0\u202f]?%/i;

export function mentionsDiscount(text: string): boolean {
  return DISCOUNT.test(text);
}

export function bilingualMentionsDiscount(value: BilingualValue | null): boolean {
  return Boolean(value && (mentionsDiscount(value.ru) || mentionsDiscount(value.uz)));
}
