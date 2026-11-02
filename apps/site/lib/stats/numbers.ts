// Числа «Статистики сайта» (фаза 6, мокап CabStats): изменение к прошлому периоду, доли панелей и
// конверсия. Считает база (site_stats); здесь — только проценты для подписей.

export type StatsDelta = { kind: "none" } | { kind: "up" | "down" | "flat"; percent: number };

/**
 * «+20,6% к прошлому периоду» — к прошлому периоду той же длины. Нет данных за прошлый период или в
 * нём ноль — сравнивать не с чем («нет данных за прошлый период», мокап).
 */
export function statsDelta(current: number, previous: number, hasPrevious: boolean): StatsDelta {
  if (!hasPrevious || previous <= 0) return { kind: "none" };
  const percent = Math.round(((current - previous) / previous) * 1000) / 10;
  if (percent === 0) return { kind: "flat", percent: 0 };
  return { kind: percent > 0 ? "up" : "down", percent: Math.abs(percent) };
}

/** Конверсия в процентах с одним знаком; без знаменателя — null («—»). */
export function conversion(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export type StatsBar<K extends string = string> = {
  key: K;
  value: number;
  share: number;
  width: number;
};

/**
 * Полосы панели (Источники, Устройства, Типы заявок): доля от суммы — целым процентом, ширина — от
 * самой длинной полосы (мокап). Пустые строки отбрасываются, порядок — по убыванию.
 */
export function statsBars<K extends string>(
  rows: readonly { key: K; value: number }[],
): StatsBar<K>[] {
  const shown = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  const total = shown.reduce((sum, row) => sum + row.value, 0);
  const max = shown[0]?.value ?? 0;
  return shown.map((row) => ({
    key: row.key,
    value: row.value,
    share: total > 0 ? Math.round((row.value / total) * 100) : 0,
    width: max > 0 ? Math.round((row.value / max) * 1000) / 10 : 0,
  }));
}

const PERCENT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const COUNT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** «2,3», «20,6», «1» — проценты статистики с одним знаком, «,0» отбрасывается (мокап trim1). */
export const formatStatsPercent = (value: number) => PERCENT.format(value);
/** «9 114» — счётчики статистики с разрядами. */
export const formatStatsCount = (value: number) => COUNT.format(value);
/** Подпись оси графика: «800», «2,5» — шаг 2,5 бывает, его дробь не округляем. */
export const formatStatsAxis = (value: number) => PERCENT.format(value);
