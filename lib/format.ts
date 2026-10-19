// Форматирование для интерфейса. Даты — по времени Ташкента (PLAN §4: lib/format.ts).
// Деньги и телефоны появятся здесь вместе с lib/calc (фаза 2) и формами (фаза 3).

export const APP_TIME_ZONE = "Asia/Tashkent";

/** «Понедельник, 19.10.2026» — подпись под заголовком Главной кабинета (мокап). */
export function formatWeekdayDate(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone }).format(date);
  const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}`;
}

/** Час суток 0–23 в часовом поясе. */
export function hourIn(date: Date, timeZone: string = APP_TIME_ZONE): number {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(date);
  return Number(hour);
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
