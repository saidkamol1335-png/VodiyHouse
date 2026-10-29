import { createTranslator } from "next-intl";
import { formatTime } from "@/lib/format";
import ru from "@/messages/ru.json";
import { addDays } from "./period";
import type { SiteStats, StatsPointValues, StatsTotals } from "./types";

// CSV «Статистики сайта» (фаза 6, мокап CabStats: «Дата;Посетители;Визиты;Просмотры;Заявки;Контакты»):
// строка на день (за один день — на час), потом итог периода и прошлый период. Точка с запятой и
// BOM — Excel с русской раскладкой открывает по двойному щелчку (как CSV заявок).

const t = createTranslator({ locale: "ru", messages: ru, namespace: "admin.stats.csvColumns" });

const COLUMNS = ["visitors", "visits", "views", "leads", "contacts"] as const;

/** «2026-10-20» → «20.10.2026». */
const dayText = (day: string) => day.split("-").reverse().join(".");
const hourText = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

// Ячейка, начатая «=», «+», «-», «@», — формула в Excel: подпись ею не станет.
const cell = (value: string | number) => {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const values = (point: StatsPointValues | StatsTotals | null) =>
  COLUMNS.map((key) => (point ? point[key] : ""));

export function statsCsv(stats: SiteStats): string {
  const header = [stats.hourly ? t("hour") : t("date"), ...COLUMNS.map((key) => t(key))];
  const rows = stats.series.map((point) => [
    stats.hourly ? hourText(point.hour) : dayText(point.day),
    ...values(point.cur),
  ]);
  // Период до сегодня посчитан до «сейчас», прошлый — до того же времени: это видно в подписи.
  const until =
    Date.parse(stats.until) < Date.parse(`${addDays(stats.to, 1)}T00:00:00+05:00`)
      ? formatTime(new Date(stats.until))
      : null;
  const label = (key: "total" | "prev", from: string, to: string) =>
    until
      ? t(`${key}Until`, { from: dayText(from), to: dayText(to), time: until })
      : t(key, { from: dayText(from), to: dayText(to) });
  rows.push([label("total", stats.from, stats.to), ...values(stats.totals)]);
  if (stats.prev_has_data)
    rows.push([label("prev", stats.prev_from, stats.prev_to), ...values(stats.prev)]);
  rows.push([t("totalNote")]);
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}

/** «vodiyhouse-statistika-2026-09-30_2026-10-29.csv». */
export function statsCsvFilename(stats: Pick<SiteStats, "from" | "to">): string {
  return `vodiyhouse-statistika-${stats.from}_${stats.to}.csv`;
}
