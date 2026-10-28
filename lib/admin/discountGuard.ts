import type { BilingualValue } from "./bilingual";

// На сайте скидок нет (PLAN §3.13): тексты витрины — спецпредложения, подборки, реклама — не
// пропускают слово «скидка / chegirma / discount». Та же проверка в базе —
// private.mentions_discount (миграция 20261028150000_showcase.sql), чтобы обойти форму было нельзя.

const DISCOUNT = /скидк|chegirma|discount/i;

export function mentionsDiscount(text: string): boolean {
  return DISCOUNT.test(text);
}

export function bilingualMentionsDiscount(value: BilingualValue | null): boolean {
  return Boolean(value && (mentionsDiscount(value.ru) || mentionsDiscount(value.uz)));
}
