import type { LocalizedText } from "@/lib/contacts";
import { filterFromSearch } from "@/lib/site/catalog/params";
import type { CatalogFilter } from "@/lib/site/catalog/filter";
import { photoFrom, type CatalogPhoto, type PhotoRecord } from "@/lib/site/catalog/records";

// Запись site_showcase() (миграция 20261028180000_site_showcase.sql) → витрина сайта: подборки,
// спецпредложения и реклама, которые видит посетитель сейчас (включённые, в периоде по ташкентской
// дате, у опубликованного застройщика); ЖК в них — только опубликованные.

export type ShowcaseDeveloperRecord = { id: string; slug: string; name: string };

export type CollectionRecord = {
  id: string;
  slug: string;
  title: LocalizedText;
  mode: "manual" | "filter";
  complex_ids: string[];
  filter: Record<string, unknown>;
  cover: PhotoRecord | null;
};

export type SpecialRecord = {
  id: string;
  kind: "gift" | "installment" | "bank" | "sales_start";
  badge: LocalizedText;
  title: LocalizedText;
  text: LocalizedText | null;
  developer: ShowcaseDeveloperRecord;
  complex_ids: string[];
  valid_to: string;
  cover: PhotoRecord | null;
};

export type AdRecord = {
  id: string;
  title: LocalizedText;
  text: LocalizedText | null;
  developer: ShowcaseDeveloperRecord;
  complex_ids: string[];
  filter: Record<string, unknown>;
  valid_to: string;
  cover: PhotoRecord | null;
};

export type SiteShowcaseRecord = {
  collections: CollectionRecord[];
  specials: SpecialRecord[];
  ads: AdRecord[];
  /** Сегодня по Ташкенту на момент чтения — «ещё N дней» считается от него. */
  today: string;
};

export type ShowcaseCollection = {
  id: string;
  slug: string;
  title: LocalizedText;
  mode: "manual" | "filter";
  complexIds: string[];
  filter: CatalogFilter;
  cover: CatalogPhoto | null;
};

export type ShowcaseSpecial = {
  id: string;
  kind: SpecialRecord["kind"];
  badge: LocalizedText;
  title: LocalizedText;
  text: LocalizedText | null;
  developer: ShowcaseDeveloperRecord;
  complexIds: string[];
  validTo: string;
  cover: CatalogPhoto | null;
};

export type ShowcaseAd = {
  id: string;
  title: LocalizedText;
  text: LocalizedText | null;
  developer: ShowcaseDeveloperRecord;
  complexIds: string[];
  filter: CatalogFilter;
  validTo: string;
  cover: CatalogPhoto | null;
};

export type SiteShowcase = {
  collections: ShowcaseCollection[];
  specials: ShowcaseSpecial[];
  ads: ShowcaseAd[];
  today: string;
};

export const EMPTY_SHOWCASE: SiteShowcase = { collections: [], specials: [], ads: [], today: "" };

/** Фильтр из базы — параметры адреса каталога как есть; чужое отпадает при разборе. */
function filterOf(raw: Record<string, unknown> | null | undefined): CatalogFilter {
  const strings = Object.fromEntries(
    Object.entries(raw ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  return filterFromSearch(strings);
}

const cover = (record: PhotoRecord | null) => (record ? photoFrom(record) : null);

export function showcaseFrom(record: SiteShowcaseRecord): SiteShowcase {
  return {
    collections: (record.collections ?? []).map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      mode: item.mode === "manual" ? "manual" : "filter",
      complexIds: item.complex_ids ?? [],
      filter: filterOf(item.filter),
      cover: cover(item.cover),
    })),
    specials: (record.specials ?? []).map((item) => ({
      id: item.id,
      kind: item.kind,
      badge: item.badge,
      title: item.title,
      text: item.text,
      developer: item.developer,
      complexIds: item.complex_ids ?? [],
      validTo: item.valid_to,
      cover: cover(item.cover),
    })),
    ads: (record.ads ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      text: item.text,
      developer: item.developer,
      complexIds: item.complex_ids ?? [],
      filter: filterOf(item.filter),
      validTo: item.valid_to,
      cover: cover(item.cover),
    })),
    today: record.today ?? "",
  };
}
