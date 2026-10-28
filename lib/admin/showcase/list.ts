import { showcaseStatus } from "./period";
import type { ShowcaseListFilter, ShowcaseListRow } from "./types";

// Списки вкладок «Витрины» (3.16а): пилюли «На сайте / Все», порядок показа — как на главной:
// по порядку руководителя, при равном — раньше добавленные.

export function sortShowcaseRows<Row extends ShowcaseListRow>(rows: readonly Row[]): Row[] {
  return [...rows].sort((a, b) => a.sort - b.sort || a.createdAt.localeCompare(b.createdAt));
}

export function filterShowcaseRows<Row extends ShowcaseListRow>(
  rows: readonly Row[],
  filter: ShowcaseListFilter,
  today: string,
): Row[] {
  const sorted = sortShowcaseRows(rows);
  return filter === "all" ? sorted : sorted.filter((row) => showcaseStatus(row, today) === "active");
}

export function showcaseCounts(
  rows: readonly ShowcaseListRow[],
  today: string,
): Record<ShowcaseListFilter, number> {
  return {
    active: rows.filter((row) => showcaseStatus(row, today) === "active").length,
    all: rows.length,
  };
}
