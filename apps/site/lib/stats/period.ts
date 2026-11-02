import { todayInTashkent } from "@/lib/admin/showcase/period";

// Период «Статистики сайта» (фаза 6, мокап CabStats): «Сегодня · 7 дней · 30 дней · Этот месяц ·
// Период…» → дни по Ташкенту для site_stats(с, по). Период живёт в адресе (?per=…&from=…&to=…):
// ссылку можно переслать, «Назад» возвращает прошлый выбор. Свой период — не в будущем и не раньше
// хранения событий (400 дней, как проверяет база); перепутанные даты меняются местами.

export const STATS_PERIODS = ["today", "7", "30", "month", "custom"] as const;
export type StatsPeriodKey = (typeof STATS_PERIODS)[number];
export const DEFAULT_STATS_PERIOD: StatsPeriodKey = "30";
export const STATS_KEEP_DAYS = 400;

export type StatsPeriod = { key: StatsPeriodKey; from: string; to: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** «ГГГГ-ММ-ДД» ± дни (полдень UTC — без перехода суток). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Сколько дней в периоде, включая оба конца. */
export function daysIn(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1
  );
}

const validDay = (value: unknown): value is string =>
  typeof value === "string" && ISO.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

function clampDay(day: string, min: string, max: string): string {
  if (day < min) return min;
  return day > max ? max : day;
}

/** Параметры адреса → период; чужое и битое — 30 дней (мокап открывается на них). */
export function statsPeriodOf(
  params: { per?: unknown; from?: unknown; to?: unknown },
  today: string = todayInTashkent(),
): StatsPeriod {
  const key = (STATS_PERIODS as readonly unknown[]).includes(params.per)
    ? (params.per as StatsPeriodKey)
    : DEFAULT_STATS_PERIOD;
  if (key === "today") return { key, from: today, to: today };
  if (key === "7" || key === "30") return { key, from: addDays(today, 1 - Number(key)), to: today };
  if (key === "month") return { key, from: `${today.slice(0, 8)}01`, to: today };
  const min = addDays(today, -STATS_KEEP_DAYS);
  const from = validDay(params.from) ? clampDay(params.from, min, today) : addDays(today, -13);
  const to = validDay(params.to) ? clampDay(params.to, min, today) : today;
  return from <= to ? { key, from, to } : { key, from: to, to: from };
}

/** Адрес периода для ссылки: свой — с датами, остальные — только ключ. */
export function statsPeriodQuery(period: StatsPeriod): string {
  const params = new URLSearchParams({ per: period.key });
  if (period.key === "custom") {
    params.set("from", period.from);
    params.set("to", period.to);
  }
  return params.toString();
}
