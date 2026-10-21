// Форматирование для интерфейса. Даты — по времени Ташкента (PLAN §4: lib/format.ts).
// Деньги и телефоны появятся здесь вместе с lib/calc (фаза 2) и формами (фаза 3).

export const APP_TIME_ZONE = "Asia/Tashkent";

/** «Понедельник, 19.10.2026» — подпись под заголовком Главной кабинета (мокап). */
export function formatWeekdayDate(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone }).format(date);
  const day = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}`;
}

/** «20.10.2026» — дата в списках кабинета. */
export function formatDate(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** «20.10.2026 14:05» — дата и время (последний вход сотрудника). */
export function formatDateTime(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  return `${formatDate(date, timeZone)} ${time}`;
}

/** Час суток 0–23 в часовом поясе. */
export function hourIn(date: Date, timeZone: string = APP_TIME_ZONE): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  return Number(hour);
}

const KILOBYTE = 1024;
const MEGABYTE = 1024 * 1024;

/** Вес файла для кабинета: «512 КБ», «2,4 МБ» (одна цифра после запятой — до 10 МБ). */
export function formatFileSize(bytes: number): string {
  if (bytes < MEGABYTE) return `${Math.max(1, Math.round(bytes / KILOBYTE))} КБ`;
  const megabytes = bytes / MEGABYTE;
  const digits = megabytes < 10 ? 1 : 0;
  const value = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(megabytes);
  return `${value} МБ`;
}

/** Инициалы для аватара: «Дилноза Юсупова» → «ДЮ», одно слово — одна буква. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

const GROUPED = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const SUM_STEP = 1000;

/**
 * Цена для кабинета и сайта (ТЗ 1.5, предложение): USD — до доллара, «$31 000»; сум — до тысячи,
 * «354 000 000 сум». Хранится цена без округления — округляет только вывод (PLAN §0.10).
 */
export function formatPrice(amount: number, currency: "USD" | "UZS"): string {
  if (currency === "USD") return `$${GROUPED.format(Math.round(amount))}`;
  return `${GROUPED.format(Math.round(amount / SUM_STEP) * SUM_STEP)} сум`;
}

const AREA = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** «42,5 м²» — площадь планировки (как подпись базы в журнале). */
export function formatArea(area: number): string {
  return `${AREA.format(area)} м²`;
}

/** «$620/м²», «4 100 000 сум/м²» — цена за м² квартиры (Н3). */
export function formatPricePerM2(amount: number, currency: "USD" | "UZS"): string {
  return `${formatPrice(amount, currency)}/м²`;
}

/** Предел цены — numeric(14,2) в базе. */
export const PRICE_MAX = 999_999_999_999;

/** Предел цены за м²: площадь (до 999,99 м²) × цена м² должна влезать в «цену от» планировки. */
export const PRICE_PER_M2_MAX = 999_999_999;

export type PriceInput = { value: number | null; issue?: "notNumber" | "outOfRange" };

/**
 * Цена, набранная руками: целое, группы — пробелами («31 000»). Запятую и точку не угадываем:
 * «31,000» с клавиатуры ПК — это 31 000, а Number() дал бы 31, поэтому такой ввод — ошибка.
 */
export function parsePriceInput(raw: string, max: number = PRICE_MAX): PriceInput {
  const digits = raw.replace(/\s+/g, "");
  if (!digits) return { value: null };
  if (!/^\d+$/.test(digits)) return { value: null, issue: "notNumber" };
  const value = Number(digits);
  return value <= 0 || value > max ? { value: null, issue: "outOfRange" } : { value };
}
