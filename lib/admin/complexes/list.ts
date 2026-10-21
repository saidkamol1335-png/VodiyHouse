import { bilingualFrom, type BilingualValue } from "../bilingual";
import type { PublicationStatus } from "../publication";
import {
  countByPublicationFilter,
  isPublicationStatus,
  matchesPublicationFilter,
  searchableText,
  type PublicationFilter,
} from "../publicationFilter";
import { EMPTY_STOCK, type ComplexStock } from "./stock";

// Список «ЖК» (решение в. 5): строки из complex_rows() в порядке каталога, остатки по комнатам,
// поиск по названию RU и UZ, городу, застройщику и адресу; пилюли статусов — как у застройщиков.

export type ComplexListRow = {
  id: string;
  slug: string;
  name: BilingualValue;
  status: PublicationStatus;
  archivedAt: string | null;
  developerId: string;
  developerName: string;
  developerStatus: PublicationStatus;
  locationName: string | null;
  stock: ComplexStock;
};

export type ComplexRowRecord = {
  id: string;
  slug: string;
  name: unknown;
  status: string;
  archived_at: string | null;
  developer_id: string;
  developer_name: string;
  developer_status: string;
  location_name: string | null;
};

const statusOf = (value: string): PublicationStatus =>
  isPublicationStatus(value) ? value : "draft";

export function parseComplexRows(
  records: readonly ComplexRowRecord[],
  stock: ReadonlyMap<string, ComplexStock>,
): ComplexListRow[] {
  return records.map((record) => ({
    id: record.id,
    slug: record.slug,
    name: bilingualFrom(record.name),
    status: statusOf(record.status),
    archivedAt: record.archived_at,
    developerId: record.developer_id,
    developerName: record.developer_name,
    developerStatus: statusOf(record.developer_status),
    locationName: record.location_name,
    stock: stock.get(record.id) ?? EMPTY_STOCK,
  }));
}

/** Опубликован, а на сайте не виден: сайт показывает ЖК только у опубликованного застройщика. */
export function isHiddenByDeveloper(row: Pick<ComplexListRow, "status" | "developerStatus">) {
  return row.status === "published" && row.developerStatus !== "published";
}

export type ComplexListQuery = {
  query: string;
  filter: PublicationFilter;
  /** «ЖК застройщика» со страницы застройщика: ?zastroyshchik=<id>. */
  developerId?: string | null;
};

function matchesQuery(row: ComplexListRow, needle: string): boolean {
  if (!needle) return true;
  const haystack = [row.name.ru, row.name.uz, row.locationName ?? "", row.developerName, row.slug];
  return haystack.some((text) => searchableText(text).includes(needle));
}

export function filterComplexes(
  rows: readonly ComplexListRow[],
  { query, filter, developerId }: ComplexListQuery,
): ComplexListRow[] {
  const needle = searchableText(query.trim());
  return rows.filter(
    (row) =>
      matchesPublicationFilter(row.status, filter) &&
      (!developerId || row.developerId === developerId) &&
      matchesQuery(row, needle),
  );
}

export function complexFilterCounts(
  rows: readonly ComplexListRow[],
  developerId?: string | null,
): Record<PublicationFilter, number> {
  const scoped = developerId ? rows.filter((row) => row.developerId === developerId) : rows;
  return countByPublicationFilter(scoped.map((row) => row.status));
}
