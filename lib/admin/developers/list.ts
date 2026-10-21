import type { PublicationStatus } from "../publication";
import {
  PUBLICATION_FILTERS,
  countByPublicationFilter,
  isPublicationStatus,
  matchesPublicationFilter,
  searchableText,
  type PublicationFilter,
} from "../publicationFilter";

// Список «Застройщики» (решение Д1): строки из developer_rows(), поиск и пилюли статусов.

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

export function parseDeveloperRows(records: readonly DeveloperRowRecord[]): DeveloperListRow[] {
  return records.map((record) => ({
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: isPublicationStatus(record.status) ? record.status : "draft",
    foundedYear: record.founded_year,
    flatsDelivered: record.flats_delivered,
    deliveredCheckedAt: record.delivered_checked_at,
    archivedAt: record.archived_at,
    complexes: record.complexes ?? 0,
    logoPath: record.logo_path,
  }));
}

export type DeveloperFilter = PublicationFilter;
export const DEVELOPER_FILTERS = PUBLICATION_FILTERS;

/** Поиск по названию и адресу: «fargona» найдёт «Farg‘ona». */
export function filterDevelopers(
  rows: readonly DeveloperListRow[],
  { query, filter }: { query: string; filter: DeveloperFilter },
): DeveloperListRow[] {
  const needle = searchableText(query.trim());
  return rows.filter(
    (row) =>
      matchesPublicationFilter(row.status, filter) &&
      (!needle || searchableText(row.name).includes(needle) || row.slug.includes(needle)),
  );
}

export function filterCounts(rows: readonly DeveloperListRow[]): Record<DeveloperFilter, number> {
  return countByPublicationFilter(rows.map((row) => row.status));
}
