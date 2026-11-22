import { textsMentionDiscount } from "@vh/shared/discounts";
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

/** Реклама — баннер (правки 15.11, п. 4 + 13): без баннера для ПК база её не отдаёт. */
export type AdRecord = {
  id: string;
  /** Название рекламы — подпись картинки (alt). */
  title: LocalizedText;
  cta: string;
  /** Подпись баннера: рекламодатель или имя застройщика (20261122100000; до миграции поля нет). */
  advertiser?: string | null;
  /** null — рекламодатель не застройщик (правки 15.11, п. 4, 20.11). */
  developer: ShowcaseDeveloperRecord | null;
  valid_to: string;
  banner: PhotoRecord;
  banner_mobile: PhotoRecord | null;
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

/** Кнопка баннера: телефон Vodiy House (tel:) или «Ariza qoldirish» — заявка типа «Реклама». */
export type AdCta = "phone" | "lead";

export type ShowcaseAd = {
  id: string;
  title: LocalizedText;
  cta: AdCta;
  /** Подпись под баннером: рекламодатель (застройщик или другая компания — правки 15.11, п. 4, 20.11). */
  advertiser: string;
  developer: ShowcaseDeveloperRecord | null;
  validTo: string;
  banner: CatalogPhoto;
  /** Картинка для телефона; null — та же, что для ПК. */
  bannerMobile: CatalogPhoto | null;
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
    ads: (record.ads ?? []).flatMap((item) =>
      item.banner
        ? [
            {
              id: item.id,
              title: item.title,
              cta: item.cta === "phone" ? "phone" : "lead",
              advertiser: item.advertiser || item.developer?.name || "",
              developer: item.developer ?? null,
              validTo: item.valid_to,
              banner: photoFrom(item.banner),
              bannerMobile: cover(item.banner_mobile),
            } satisfies ShowcaseAd,
          ]
        : [],
    ),
    today: record.today ?? "",
  };
}

/**
 * Скидки выключены («Витрина → Спецпредложения», по умолчанию — п. 4 + 21 правок 15.11): спецпредложения
 * со скидкой в бейдже, заголовке или тексте сайт не показывает; название рекламы со скидкой не идёт в
 * подпись картинки — вместо него имя рекламодателя.
 */
export function withoutDiscounts(showcase: SiteShowcase): SiteShowcase {
  return {
    ...showcase,
    specials: showcase.specials.filter((special) => !textsMentionDiscount(special.badge, special.title, special.text)),
    ads: showcase.ads.map((ad) =>
      textsMentionDiscount(ad.title) ? { ...ad, title: { ru: ad.advertiser, uz: ad.advertiser } } : ad,
    ),
  };
}
