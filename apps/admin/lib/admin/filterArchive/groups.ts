import {
  archiveIdSection,
  archiveIdValue,
  FILTER_SECTIONS,
  type FilterArchive,
  type FilterSection,
  optionArchiveId,
  sectionArchiveId,
} from "@vh/shared/filterArchive";
import { PAYMENT_KINDS, ROOM_CHIPS } from "@/lib/site/catalog/filter";
import type { SiteCatalog } from "@/lib/site/catalog/records";

// «Настройки → Фильтр сайта» (06.11.2026): кнопки фильтра в том же составе и порядке, что на сайте
// (CatalogFilter): комнаты и оплата — всегда, сроки, районы, застройщики и отделка — из каталога.

export type FilterArchiveOption = { id: string; label: string; archivedAt: string | null };

export type FilterArchiveGroup = {
  section: FilterSection;
  /** id блока целиком. */
  id: string;
  archivedAt: string | null;
  options: FilterArchiveOption[];
};

/** Подписи, которые зависят от языка кабинета (messages admin.filterArchive). */
export type FilterArchiveLabels = {
  room: (rooms: number) => string;
  payment: (kind: (typeof PAYMENT_KINDS)[number]) => string;
  built: string;
  upTo: (year: number) => string;
};

/** Чипов «до года» — как на сайте: ближайшие годы сдачи каталога. */
const DEADLINE_YEARS = 3;

function deadlineYears(catalog: SiteCatalog | null): number[] {
  const years = (catalog?.complexes ?? []).flatMap((c) =>
    c.blocks.flatMap((b) => (b.buildStatus === "building" && b.deadline ? [b.deadline.year] : [])),
  );
  return [...new Set(years)].sort((a, b) => a - b).slice(0, DEADLINE_YEARS);
}

type Pair = readonly [value: string | number, label: string];

function optionPairs(
  section: FilterSection,
  catalog: SiteCatalog | null,
  labels: FilterArchiveLabels,
): Pair[] {
  const complexes = catalog?.complexes ?? [];
  switch (section) {
    case "rooms":
      return ROOM_CHIPS.map((rooms) => [rooms, labels.room(rooms)] as const);
    case "payment":
      return PAYMENT_KINDS.map((kind) => [kind, labels.payment(kind)] as const);
    case "deadline":
      return [
        ["built", labels.built] as const,
        ...deadlineYears(catalog).map((year) => [year, labels.upTo(year)] as const),
      ];
    case "location":
      return [
        ...new Map(
          complexes.flatMap((c) =>
            c.location ? [[c.location.slug, c.location.name.ru] as const] : [],
          ),
        ),
      ];
    case "developer":
      return (catalog?.developers ?? []).map((d) => [d.slug, d.name] as const);
    case "finishing":
      return [
        ...new Map(
          complexes.flatMap((c) =>
            c.blocks.flatMap((b) =>
              b.finishing ? [[b.finishing.slug, b.finishing.name.ru] as const] : [],
            ),
          ),
        ),
      ];
    case "price":
      return [];
  }
}

/**
 * Группы экрана: блоки фильтра сайта с кнопками и пометкой «в архиве». Кнопка из архива, которой
 * сейчас на сайте нет (застройщик снят, год прошёл), остаётся в своей группе — её можно вернуть.
 */
export function filterArchiveGroups(
  archive: FilterArchive,
  catalog: SiteCatalog | null,
  labels: FilterArchiveLabels,
): FilterArchiveGroup[] {
  const archivedAt = new Map(archive.items.map((item) => [item.id, item.at]));
  return FILTER_SECTIONS.map((section) => {
    const options: FilterArchiveOption[] = optionPairs(section, catalog, labels).map(
      ([value, label]) => {
        const id =
          section === "price" ? sectionArchiveId(section) : optionArchiveId(section, value);
        return { id, label, archivedAt: archivedAt.get(id) ?? null };
      },
    );
    const known = new Set(options.map((option) => option.id));
    for (const item of archive.items) {
      const value = archiveIdValue(item.id);
      if (value === null || known.has(item.id) || archiveIdSection(item.id) !== section) continue;
      const year = Number(value);
      const label =
        section === "deadline" && value !== "built" && Number.isInteger(year)
          ? labels.upTo(year)
          : value;
      options.push({ id: item.id, label, archivedAt: item.at });
    }
    const id = sectionArchiveId(section);
    return { section, id, archivedAt: archivedAt.get(id) ?? null, options };
  });
}
