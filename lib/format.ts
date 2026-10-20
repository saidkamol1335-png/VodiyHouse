// Форматирование для интерфейса. Даты — по времени Ташкента (PLAN §4: lib/format.ts).
// Деньги и телефоны появятся здесь вместе с lib/calc (фаза 2) и формами (фаза 3).

export const APP_TIME_ZONE = "Asia/Tashkent";

/** «Понедельник, 19.10.2026» — подпись под заголовком Главной кабинета (мокап). */
export function formatWeekdayDate(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone }).format(date);
  const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}`;
}

/** «20.10.2026» — дата в списках кабинета. */
export function formatDate(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date);
}

/** «20.10.2026 14:05» — дата и время (последний вход сотрудника). */
export function formatDateTime(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(
    date,
  );
  return `${formatDate(date, timeZone)} ${time}`;
}

/** Час суток 0–23 в часовом поясе. */
export function hourIn(date: Date, timeZone: string = APP_TIME_ZONE): number {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(date);
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
