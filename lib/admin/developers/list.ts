import { PUBLICATION_STATUSES, type PublicationStatus } from "../publication";

// Список «Застройщики» (решение Д1): строки из developer_rows(), поиск и пилюли статусов.
// Застройщиков немного (на старте 10–15), поэтому ищем и считаем в браузере, без запросов.

export type DeveloperListRow = {
  id: string;
  slug: string;
  name: string;
  status: PublicationStatus;
  foundedYear: number | null;
  flatsDelivered: number | null;
  deliveredCheckedAt: string | null;
  archivedAt: string | null;
  complexes: number;
  logoPath: string | null;
};

export type DeveloperRowRecord = {
  id: string;
  slug: string;
  name: string;
  status: string;
  founded_year: number | null;
  flats_delivered: number | null;
  delivered_checked_at: string | null;
  archived_at: string | null;
  complexes: number | null;
  logo_path: string | null;
};

const isStatus = (value: string): value is PublicationStatus =>
  (PUBLICATION_STATUSES as readonly string[]).includes(value);

export function parseDeveloperRows(records: readonly DeveloperRowRecord[]): DeveloperListRow[] {
  return records.map((record) => ({
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: isStatus(record.status) ? record.status : "draft",
    foundedYear: record.founded_year,
    flatsDelivered: record.flats_delivered,
    deliveredCheckedAt: record.delivered_checked_at,
    archivedAt: record.archived_at,
    complexes: record.complexes ?? 0,
    logoPath: record.logo_path,
  }));
}

/** «Все» — без архива: архив — корзина на 30 дней, у него своя пилюля. */
export type DeveloperFilter = "all" | PublicationStatus;
export const DEVELOPER_FILTERS: readonly DeveloperFilter[] = ["all", ...PUBLICATION_STATUSES];

const APOSTROPHES = /['‘’ʻʼ`´]/g;
const searchable = (text: string) => text.replace(APOSTROPHES, "").toLowerCase();

function matchesFilter(row: DeveloperListRow, filter: DeveloperFilter): boolean {
  return filter === "all" ? row.status !== "archived" : row.status === filter;
}

/** Поиск по названию и адресу: «fargona» найдёт «Farg‘ona». */
export function filterDevelopers(
  rows: readonly DeveloperListRow[],
  { query, filter }: { query: string; filter: DeveloperFilter },
): DeveloperListRow[] {
  const needle = searchable(query.trim());
  return rows.filter(
    (row) =>
      matchesFilter(row, filter) &&
      (!needle || searchable(row.name).includes(needle) || row.slug.includes(needle)),
  );
}

export function filterCounts(rows: readonly DeveloperListRow[]): Record<DeveloperFilter, number> {
  return Object.fromEntries(
    DEVELOPER_FILTERS.map((filter) => [
      filter,
      rows.filter((row) => matchesFilter(row, filter)).length,
    ]),
  ) as Record<DeveloperFilter, number>;
}
