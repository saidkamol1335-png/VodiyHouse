import type { BilingualValue } from "./bilingual";

// Правило ТЗ 1.2: в публичной части нет ни одного контакта застройщика. Тексты ЖК и застройщика
// («реши сам» шага 11) не пропускают телефон, сайт, @ник и ссылку на Telegram. Порог телефона —
// 9 цифр подряд (с пробелами и дефисами): «1 500 000 сум» и «ул. Навои, 45» проходят.

const PHONE = /(?:\+?\d[\s\-().]*){9,}/;
const LINK = /(?:https?:\/\/|www\.|\bt\.me\/)/i;
const DOMAIN = /\b[a-z0-9-]+\.(?:uz|com|ru|net|org|info|me|io|su)\b/i;
const HANDLE = /(?:^|[\s(])@[a-z0-9_]{4,}/i;

export function containsContact(text: string): boolean {
  return [PHONE, LINK, DOMAIN, HANDLE].some((pattern) => pattern.test(text));
}

export function bilingualHasContact(value: BilingualValue | null): boolean {
  return Boolean(value && (containsContact(value.ru) || containsContact(value.uz)));
}
