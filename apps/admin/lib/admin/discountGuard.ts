import { mentionsDiscount } from "@vh/shared/discounts";
import type { BilingualValue } from "./bilingual";

// Названия подборок без скидок (PLAN §3.13; с 06.11.2026 спецпредложения и реклама скидки называть
// могут — PLAN §10 п. 51, allowDiscount в showcase/forms.ts). Сама проверка — @vh/shared/discounts
// (общая с сайтом: там выключатель «Показывать скидки» прячет такие спецпредложения).

export { mentionsDiscount };

export function bilingualMentionsDiscount(value: BilingualValue | null): boolean {
  return Boolean(value && (mentionsDiscount(value.ru) || mentionsDiscount(value.uz)));
}
