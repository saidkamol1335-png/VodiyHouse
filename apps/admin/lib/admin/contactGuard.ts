import type { BilingualValue } from "./bilingual";

// Правило ТЗ 1.2: в публичной части нет ни одного контакта застройщика. Тексты ЖК и застройщика
// («реши сам» шага 11) не пропускают телефон, сайт, @ник и ссылку на Telegram. Порог телефона —
// 9 цифр подряд (с пробелами, точками, дефисами, тире и косой чертой): «ул. Навои, 45» проходит.
// Суммы с валютой (и диапазоны цен), даты и номера документов телефоном не считаются: цены в
// сумах — от 9 цифр («от 450 000 000 сум», «450.000.000 so‘m»).

const PHONE = /(?:\+?\d[\s\-‐-―().\/]*){9,}/;
const AMOUNT = String.raw`(?:\d{1,3}(?:[\s.,]\d{3})+|\d{4,12})`;
// Обычная строка, а не String.raw: в вариантах апострофа so‘m есть обратная кавычка.
const CURRENCY = "(?:сум|сўм|so[‘'ʻ`’]?m|sum|uzs|млн|млрд|mln|mlrd|\\$|usd|у\\.\\s?е\\.)";
// «от 450 000 000 до 900 000 000 сум», «120 000 000–150 000 000 so‘m»: валюта — только у второй.
const PRICE_RANGE = new RegExp(
  String.raw`${AMOUNT}\s*(?:до|gacha|[-–—])\s*${AMOUNT}\s*${CURRENCY}`,
  "giu",
);
const MONEY = new RegExp(String.raw`${AMOUNT}\s*${CURRENCY}`, "giu");
const DATE = /\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g;
const DOCUMENT_NUMBER = /№\s*[\d\/\-]+/g;
const LINK = /(?:https?:\/\/|www\.|\bt\.me\/)/i;
const DOMAIN =
  /\b[a-z0-9-]+\.(?:uz|com|ru|net|org|info|me|io|su|online|pro|biz|site|app|dev|store|shop|tj|kz|xyz|tel)\b/i;
// Перед @ — не буква и не точка: «Telegram:@nick» и ««@nick»» — ник, «info@sifat.uz» ловит DOMAIN.
const HANDLE = /(?:^|[^\w.@])@[a-z0-9_]{4,}/i;

/** Текст без сумм, дат и номеров документов — в нём ищем телефон. */
function withoutNumbersThatAreNotPhones(text: string): string {
  return [PRICE_RANGE, MONEY, DATE, DOCUMENT_NUMBER].reduce(
    (rest, pattern) => rest.replace(pattern, " "),
    text,
  );
}

export function containsContact(text: string): boolean {
  return (
    PHONE.test(withoutNumbersThatAreNotPhones(text)) ||
    [LINK, DOMAIN, HANDLE].some((pattern) => pattern.test(text))
  );
}

export function bilingualHasContact(value: BilingualValue | null): boolean {
  return Boolean(value && (containsContact(value.ru) || containsContact(value.uz)));
}
