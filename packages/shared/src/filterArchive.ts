// Архив кнопок фильтра каталога («Настройки → Фильтр сайта», 06.11.2026): руководитель или менеджер
// убирает с сайта кнопку фильтра (Studiya, Ipoteka, 2028 gacha, White box, район, застройщик…) или
// целый блок (весь «To‘lov usuli», «Kvartira narxi»…) до ручного возврата. Публичная запись settings
// `site.filter_archive`: пишет кабинет, читает сайт ролью посетителя (public_settings).

export const FILTER_ARCHIVE_KEY = "site.filter_archive";

/** Блоки фильтра сайта — в порядке на экране. */
export const FILTER_SECTIONS = [
  "rooms",
  "price",
  "location",
  "payment",
  "deadline",
  "developer",
  "finishing",
] as const;
export type FilterSection = (typeof FILTER_SECTIONS)[number];

/** Блоки, у которых есть отдельные кнопки или пункты списка (у цены — только блок целиком). */
export const FILTER_OPTION_SECTIONS = [
  "rooms",
  "location",
  "payment",
  "deadline",
  "developer",
  "finishing",
] as const;
export type FilterOptionSection = (typeof FILTER_OPTION_SECTIONS)[number];

export type ArchivedFilterItem = {
  /** «section:payment» — блок целиком; «payment:mort», «rooms:0», «deadline:2028», «developer:slug» — кнопка. */
  id: string;
  /** Когда убрали в архив (ISO). */
  at: string;
};

export type FilterArchive = { items: ArchivedFilterItem[] };

export const EMPTY_FILTER_ARCHIVE: FilterArchive = { items: [] };

/** Больше кнопок у фильтра не бывает; защита от раздутой записи. */
export const FILTER_ARCHIVE_MAX = 200;

const SECTION_ID = new RegExp(`^section:(${FILTER_SECTIONS.join("|")})$`);
// Значения: комнаты 0–4, способы оплаты, «built» или год, slug района / застройщика / отделки.
const OPTION_ID = new RegExp(`^(${FILTER_OPTION_SECTIONS.join("|")}):[a-z0-9][a-z0-9_-]{0,79}$`);

export const sectionArchiveId = (section: FilterSection): string => `section:${section}`;
export const optionArchiveId = (section: FilterOptionSection, value: string | number): string =>
  `${section}:${value}`;

export function isFilterArchiveId(id: unknown): id is string {
  return typeof id === "string" && (SECTION_ID.test(id) || OPTION_ID.test(id));
}

/** Блок записи архива: «section:payment» → payment, «payment:mort» → payment. */
export function archiveIdSection(id: string): FilterSection | null {
  const [head, value] = id.split(":", 2);
  const section = head === "section" ? value : head;
  return (FILTER_SECTIONS as readonly string[]).includes(section ?? "")
    ? (section as FilterSection)
    : null;
}

/** Значение кнопки записи («payment:mort» → «mort»); у блока целиком — null. */
export function archiveIdValue(id: string): string | null {
  const index = id.indexOf(":");
  return id.startsWith("section:") || index < 0 ? null : id.slice(index + 1);
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

/** Значение из базы (jsonb) → архив; кривые и повторные записи отбрасываются, сайт их не прячет. */
export function filterArchiveFrom(raw: unknown): FilterArchive {
  if (!raw || typeof raw !== "object") return EMPTY_FILTER_ARCHIVE;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return EMPTY_FILTER_ARCHIVE;
  const seen = new Set<string>();
  const result: ArchivedFilterItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const { id, at } = item as Partial<ArchivedFilterItem>;
    if (!isFilterArchiveId(id) || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, at: isIsoDate(at) ? at : new Date(0).toISOString() });
    if (result.length >= FILTER_ARCHIVE_MAX) break;
  }
  return { items: result };
}

/** Кнопка или блок — в архив (повторно — без изменений). */
export function archiveFilterItem(archive: FilterArchive, id: string, at: string): FilterArchive {
  if (!isFilterArchiveId(id) || archive.items.some((item) => item.id === id)) return archive;
  return { items: [...archive.items, { id, at }].slice(-FILTER_ARCHIVE_MAX) };
}

/** Вернуть из архива на сайт. */
export function restoreFilterItem(archive: FilterArchive, id: string): FilterArchive {
  return { items: archive.items.filter((item) => item.id !== id) };
}

/** Что скрыто на сайте: проверка блока и кнопки по набору id архива. */
export type FilterVisibility = {
  section: (section: FilterSection) => boolean;
  option: (section: FilterOptionSection, value: string | number) => boolean;
};

export function filterVisibility(archivedIds: Iterable<string>): FilterVisibility {
  const hidden = new Set(archivedIds);
  const section = (name: FilterSection) => !hidden.has(sectionArchiveId(name));
  return {
    section,
    option: (name, value) => section(name) && !hidden.has(optionArchiveId(name, value)),
  };
}
