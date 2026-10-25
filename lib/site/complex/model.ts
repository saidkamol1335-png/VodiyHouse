import type { LocalizedText } from "@/lib/contacts";
import type { Currency } from "@/lib/calc/money";
import type { CatalogBlock, CatalogPhoto, SiteCatalog } from "@/lib/site/catalog/records";
import type { NearbyPlace } from "./nearby";
import type { PageBlockRecord, PageComplexRecord, PriceIncludeRecord } from "./records";

// Страница ЖК для компонентов (шаг 3.5): что показывает сайт — числа числами, даты строками ISO;
// запись базы и преобразователь — records.ts.

export type DeadlineShift = {
  from: { year: number; quarter: number };
  to: { year: number; quarter: number };
  changedOn: string;
};

export type ComplexBlock = CatalogBlock & {
  progressPct: number | null;
  floorsBuilt: number | null;
  finishingHint: LocalizedText | null;
  cadastre: PageBlockRecord["cadastre"];
  cadastreExpectedOn: string | null;
  priceIncludes: PriceIncludeRecord[];
  /** Свободно в блоке; null — у блока нет списка квартир (PLAN §3.1). */
  free: number | null;
  history: DeadlineShift[];
};

export type ComplexLayout = {
  id: string;
  blockId: string;
  rooms: number;
  area: number;
  free: number | null;
  available: boolean;
  priceFrom: number | null;
  floors: { from: number; to: number } | null;
  drawing: CatalogPhoto | null;
};

export type ComplexDeveloper = {
  id: string;
  slug: string;
  name: string;
  about: LocalizedText | null;
  foundedYear: number | null;
  deliveredCheckedAt: string | null;
  logo: CatalogPhoto | null;
  built: number;
  building: number;
};

export type OtherComplex = {
  slug: string;
  name: LocalizedText;
  location: LocalizedText | null;
  photo: CatalogPhoto | null;
  prices: { currency: Currency; amount: number }[];
};

export type ComplexPage = Omit<
  PageComplexRecord,
  "short_description" | "house_type" | "ceiling_height" | "minutes_to_center" | "lat" | "lng" | "nearby" | "stock_updated_at" | "on_site"
> & {
  /** Видит ли страницу посетитель (ЖК и застройщик опубликованы) — для пометки предпросмотра. */
  onSite: boolean;
  shortDescription: LocalizedText | null;
  houseType: PageComplexRecord["house_type"];
  ceilingHeight: number | null;
  minutesToCenter: number | null;
  point: { lat: number; lng: number } | null;
  nearby: NearbyPlace[];
  stockUpdatedAt: string | null;
  developer: ComplexDeveloper;
  photos: CatalogPhoto[];
  blocks: ComplexBlock[];
  layouts: ComplexLayout[];
  documents: { slug: string; name: LocalizedText; hint: LocalizedText | null; checkedOn: string }[];
  videos: { youtubeId: string; title: LocalizedText | null }[];
  details: { slug: string; name: LocalizedText; text: LocalizedText; photo: CatalogPhoto | null }[];
  others: OtherComplex[];
  /** Курс и программы застройщика в виде каталога — для «Платёж от» и цены «от» (card.ts). */
  catalog: SiteCatalog;
};
