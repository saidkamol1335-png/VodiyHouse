// Проверка «на сайте нет вымышленных данных» (решение 02.11.2026, docs/prod-check.md): что не должно
// встречаться в HTML и видимом тексте прода. Чистые функции — их же гоняет юнит-тест.

/**
 * Названия ЖК, застройщиков и людей из мокапа и DEMO (supabase/demo/seed.sql, мокап Main.dc.html).
 * Без совпадений с настоящими ЖК из docs/zhk/content.json: Shodlik — и DEMO, и настоящий, его не ищем.
 */
export const FICTIONAL_NAMES: readonly string[] = [
  "Namuna",
  "Yulduz",
  "Orzu",
  "Yangi Makon",
  "Sayhun",
  "Navro‘z Qurilish",
  "Marg‘ilon Invest",
  "Kamalak Development",
  "Farg‘ona Sifat Qurilish",
  "Barakat Development",
  "Sifat City",
  "Marg‘ilon Park",
  "Gulzor",
  "Do‘stlik",
  "Сардор Алиев",
  "Нигора Саидова",
  "Жасур Тошматов",
  "Дилноза Юсупова",
  "Бахтиёр Каримов",
  "Азиз Рахимов",
  "ул. Мустакиллик, 12",
  "ул. Навои, 45",
  "ул. Маргилонская, 77",
];

/** Пометки черновика и заглушек. «demo-» — slug DEMO-записей в ссылках и адресах картинок. */
export const PLACEHOLDER_MARKERS: readonly RegExp[] = [
  /\bDEMO\b/,
  /\bTODO\b/,
  /\bLorem\b/i,
  /\/demo-[a-z]/,
  /example\.com/,
  /\be2e-/i,
];

/** Нули вместо данных: «0 ЖК», «Найдено 0», «0 жилых комплексов», «0 ta TJM» и т. п. */
export const ZERO_COUNTS: readonly RegExp[] = [
  /(^|[^\d\s.,])\s*0\+?\s+(ЖК|TJM|жил|застройщ|квартир|кв\.|ta\b)/,
  /Найден[оа]?\s+0\b/,
  /\b0 ta\b/,
];

/**
 * Телефоны Узбекистана: +998 73 244 12 34 (после +998 — любой код), без +998 — мобильные (20, 33, 50,
 * 55, 77, 87, 88, 9x) и городские (61–79: Фергана 73, Андижан 74, Наманган 69…): (90) 123-45-67, 901234567.
 */
const PHONE =
  /(?:\+?998[\s-]?\(?\d{2}\)?|\(?\b(?:20|33|50|55|6[1-9]|7\d|87|88|9\d)\)?)[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g;

/** Ссылки-контакты: звонок и мессенджеры. «Поделиться» (t.me/share) — не контакт. */
const CONTACT_LINK =
  /href="(tel:[^"]+|https?:\/\/(?:t\.me\/(?!share)|telegram\.me\/|wa\.me\/|api\.whatsapp\.com\/|(?:www\.)?instagram\.com\/|viber:)[^"]*)"/g;

/** Конец «"ключ":» перед числом (и экранированный \": в данных RSC). */
const JSON_NUMBER = /\\?"\s*:\s*$/;

export const phoneDigits = (value: string) => value.replace(/\D/g, "").replace(/^998/, "");

export type FictionHit = { rule: string; match: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Находки в тексте страницы. allowedPhones — номер Vodiy House из «Настройки → Контакты» (цифры без
 * 998); любой другой телефон — находка (правило 1.2: контактов застройщика на сайте нет).
 */
export function findFiction(text: string, allowedPhones: readonly string[] = []): FictionHit[] {
  const hits: FictionHit[] = [];
  for (const name of FICTIONAL_NAMES) {
    const match = new RegExp(`(^|[^\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`, "u").exec(text);
    if (match) hits.push({ rule: "название из мокапа или DEMO", match: name });
  }
  for (const marker of PLACEHOLDER_MARKERS) {
    const match = marker.exec(text);
    if (match) hits.push({ rule: "заглушка", match: match[0] });
  }
  const allowed = new Set(allowedPhones.map(phoneDigits));
  for (const match of text.matchAll(PHONE)) {
    // Число сразу после «"ключ":» — значение данных (цена в JSON-LD и данных страницы: "lowPrice":682682000),
    // а не номер на экране: телефоны в данных — строки (запуск 03.11, ложная находка у Shodlik).
    if (JSON_NUMBER.test(text.slice(Math.max(0, match.index - 4), match.index))) continue;
    if (!allowed.has(phoneDigits(match[0]))) hits.push({ rule: "телефон", match: match[0].trim() });
  }
  return hits;
}

/**
 * Ссылки «Позвонить» и мессенджеров в HTML: разрешены только контакты Vodiy House — номер
 * (allowedPhones) и адреса из «Настройки → Контакты» (allowedLinks, например t.me/vodiyhouse).
 */
export function findContactLinks(
  html: string,
  allowedPhones: readonly string[] = [],
  allowedLinks: readonly string[] = [],
): FictionHit[] {
  const phones = new Set(allowedPhones.map(phoneDigits));
  const hits: FictionHit[] = [];
  for (const [, href] of html.matchAll(CONTACT_LINK)) {
    const allowed = href!.startsWith("tel:")
      ? phones.has(phoneDigits(href!))
      : allowedLinks.some((link) => href!.toLowerCase().includes(link.toLowerCase()));
    if (!allowed) hits.push({ rule: "ссылка-контакт не Vodiy House", match: href! });
  }
  return hits;
}

/** Нулевые счётчики в видимом тексте (только текст страницы, не HTML: в разметке цифры бывают где угодно). */
export function findZeroCounts(visibleText: string): FictionHit[] {
  return ZERO_COUNTS.flatMap((pattern) => {
    const match = pattern.exec(visibleText);
    return match ? [{ rule: "ноль вместо данных", match: match[0].trim() }] : [];
  });
}
