import type { MatrixCell, MatrixRow, ProgressMatrix } from "./types";

// Матрица «Отчёты по ЖК · последние 6 месяцев» (фаза 5, мокап CabReview): по отчётам блоков (не квартир).
// «45+ дн.» — последний опубликованный отчёт по ЖК старше 45 дней или его нет совсем (в мокапе такой ЖК
// выпадал — решение, docs/design-decisions.md); сданный целиком ЖК отчётов не ждёт.

export const LATE_DAYS = 45;
const DAY_MS = 86_400_000;

export type MatrixComplex = { id: string; name: string; built: boolean };
export type MatrixReport = {
  id: string;
  complexId: string;
  month: string;
  status: "review" | "published";
  publishedAt: string | null;
};

/** «16.08» — день и месяц публикации по Ташкенту. */
const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(iso));

function cellOf(
  complex: MatrixComplex,
  reports: readonly MatrixReport[],
  month: string,
  current: string,
): MatrixCell {
  if (complex.built) return { kind: "built" };
  const inMonth = reports.filter(
    (report) => report.complexId === complex.id && report.month === month,
  );
  const published = inMonth
    .filter((report) => report.status === "published" && report.publishedAt)
    .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!))[0];
  if (published)
    return { kind: "published", date: dayMonth(published.publishedAt!), reportId: published.id };
  const review = inMonth.find((report) => report.status === "review");
  if (review) return { kind: "review", reportId: review.id };
  return month === current ? { kind: "wait" } : { kind: "none" };
}

export function isLate(
  complex: MatrixComplex,
  reports: readonly MatrixReport[],
  now: Date,
): boolean {
  if (complex.built) return false;
  const last = reports
    .filter(
      (report) =>
        report.complexId === complex.id && report.status === "published" && report.publishedAt,
    )
    .reduce<number | null>(
      (max, report) => Math.max(max ?? 0, Date.parse(report.publishedAt!)),
      null,
    );
  return last === null || now.getTime() - last > LATE_DAYS * DAY_MS;
}

/** Строки — ЖК по названию; ячейки — по месяцам months (последний — текущий). */
export function buildMatrix(
  complexes: readonly MatrixComplex[],
  reports: readonly MatrixReport[],
  months: readonly string[],
  now: Date,
): ProgressMatrix {
  const current = months.at(-1) ?? "";
  const rows: MatrixRow[] = [...complexes]
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((complex) => ({
      complexId: complex.id,
      name: complex.name,
      late: isLate(complex, reports, now),
      cells: months.map((month) => cellOf(complex, reports, month, current)),
    }));
  return { months: [...months], rows, late: rows.filter((row) => row.late).length };
}
