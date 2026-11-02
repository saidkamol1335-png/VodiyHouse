import type { CatalogComplex, CatalogPhoto, SiteCatalog } from "@/lib/site/catalog/records";
import type { DeveloperPage, DeveloperSummary } from "./records";

// Страница и список застройщиков (шаг 3.15): счётчики, проверки и поиск — из кэша каталога и
// записи застройщика, без запросов к базе.

/** ТЗ 8.6: «Сдано» — все блоки сданы (и блоки есть); остальное — «Строится». ЖК ровно в одной вкладке. */
export const isDelivered = (complex: CatalogComplex): boolean =>
  complex.blocks.length > 0 && complex.blocks.every((block) => block.buildStatus === "delivered");

/** ЖК застройщика на сайте — в порядке каталога (порядок руководителя). */
export function developerComplexes(catalog: SiteCatalog, developerId: string): CatalogComplex[] {
  return catalog.complexes.filter((complex) => complex.developerId === developerId);
}

export type DeveloperCounts = { all: number; built: number; building: number };

export function developerCounts(complexes: readonly CatalogComplex[]): DeveloperCounts {
  const built = complexes.filter(isDelivered).length;
  return { all: complexes.length, built, building: complexes.length - built };
}

export type DeveloperCheckKey = "permit" | "land" | "delivered" | "visit";
export type DeveloperCheck = { key: DeveloperCheckKey; date: string };
/** verified — плашка целиком с заголовком; иначе только пройденные пункты (ТЗ 8.4). */
export type DeveloperChecks = { verified: boolean; checks: DeveloperCheck[] };

// Даты ISO (гггг-мм-дд) сравниваются как строки.
const latest = (dates: readonly (string | null)[]): string | null =>
  dates.reduce<string | null>((max, date) => (date && (!max || date > max) ? date : max), null);

const fullyChecked = (complex: CatalogComplex) =>
  Boolean(complex.checked.permit && complex.checked.land && complex.checked.visit);

/**
 * «Проверено Vodiy House» на странице застройщика (ТЗ 8.4, предложение): разрешение, земля и визит —
 * по его ЖК на сайте (последняя дата проверки), «сданные объекты» — по застройщику. Плашка целиком —
 * если хоть один ЖК прошёл все проверки и сданные объекты проверены; иначе — только пройденное.
 */
export function developerChecks(developer: DeveloperSummary, complexes: readonly CatalogComplex[]): DeveloperChecks {
  const dates: [DeveloperCheckKey, string | null][] = [
    ["permit", latest(complexes.map((complex) => complex.checked.permit))],
    ["land", latest(complexes.map((complex) => complex.checked.land))],
    ["delivered", developer.deliveredCheckedAt],
    ["visit", latest(complexes.map((complex) => complex.checked.visit))],
  ];
  const checks = dates.flatMap(([key, date]) => (date ? [{ key, date }] : []));
  const verified = Boolean(developer.deliveredCheckedAt) && complexes.some(fullyChecked);
  return { verified, checks };
}

/** Фон первого экрана (ТЗ 8.2 — фото объектов застройщика): свой фон, иначе обложка первого ЖК. */
export function developerCover(page: DeveloperPage, complexes: readonly CatalogComplex[]): CatalogPhoto | null {
  return page.cover ?? complexes.find((complex) => complex.photos[0])?.photos[0] ?? null;
}

// Без апострофов бренда (Farg‘ona / Farg'ona) и регистра: «sifat» находит Farg‘ona Sifat Qurilish.
const APOSTROPHES = /[‘’'`ʻ]/g;
const fold = (text: string) => text.toLowerCase().replace(APOSTROPHES, "").replace(/\s+/g, " ").trim();

export function searchDevelopers<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const needle = fold(query);
  return needle ? rows.filter((row) => fold(row.name).includes(needle)) : [...rows];
}

/** Цветов монограмм (мокап SiteDevs): --developer-mark-1…5 в styles/tokens.css. */
export const MARK_TONES = 5;

/** Цвет монограммы застройщика без логотипа — от названия: у одного застройщика всегда один. */
export function markTone(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return (hash % MARK_TONES) + 1;
}
