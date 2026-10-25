import type { LocalizedText } from "@/lib/contacts";
import type { Currency, ExchangeRate } from "@/lib/calc/money";
import type { CalcProgram } from "@/lib/calc/programs";
import { programFromRecord, rateFromRecord, type SiteProgramsRecord } from "@/lib/calc/records";
import type { SitePhotoData } from "@/lib/site/photo";

// Запись site_catalog() (20261025120000_site_catalog.sql) → каталог сайта. numeric приходит и
// строкой — числа приводятся явно; полей скидки в записи нет (PLAN §3.13).

type NumberLike = number | string;

export type OfferRecord = {
  rooms: number;
  available: boolean;
  free: number | null;
  area_from: NumberLike | null;
  price_from: NumberLike | null;
  price_to: NumberLike | null;
  price_per_m2_from: NumberLike | null;
};

export type BlockRecord = {
  id: string;
  name: string;
  currency: Currency;
  build_status: "building" | "delivered";
  deadline_year: number | null;
  deadline_quarter: number | null;
  floors_total: number | null;
  finishing: { slug: string; name: LocalizedText } | null;
  offers: OfferRecord[];
};

export type PhotoRecord = {
  path: string;
  width: number;
  height: number;
  blur: string | null;
  focus_x: number;
  focus_y: number;
  alt: LocalizedText | null;
};

export type ComplexRecord = {
  id: string;
  slug: string;
  name: LocalizedText;
  /** Класс не обязателен для публикации — без него на карточке нет плашки. */
  class: "econom" | "comfort" | "business" | "premium" | null;
  sort: number;
  developer_id: string;
  location: { slug: string; kind: "city" | "district"; name: LocalizedText } | null;
  address: LocalizedText | null;
  landmark: LocalizedText | null;
  minutes_to_center: number | null;
  checked: { permit: string | null; land: string | null; visit: string | null };
  created_at: string;
  photos: PhotoRecord[];
  blocks: BlockRecord[];
};

export type SiteCatalogRecord = SiteProgramsRecord & { complexes: ComplexRecord[] };

export type CatalogOffer = {
  rooms: number;
  available: boolean;
  /** null — блок без списка квартир: «есть», но сколько — неизвестно (PLAN §3.1). */
  free: number | null;
  areaFrom: number | null;
  priceFrom: number | null;
  /** Самая дорогая свободная квартира типа — для фильтра «цена от». */
  priceTo: number | null;
  pricePerM2From: number | null;
};

export type CatalogBlock = Omit<BlockRecord, "build_status" | "deadline_year" | "deadline_quarter" | "floors_total" | "offers"> & {
  buildStatus: BlockRecord["build_status"];
  deadline: { year: number; quarter: number } | null;
  floorsTotal: number | null;
  offers: CatalogOffer[];
};

export type CatalogPhoto = SitePhotoData & { alt: LocalizedText | null };

export type CatalogComplex = Omit<ComplexRecord, "developer_id" | "minutes_to_center" | "created_at" | "photos" | "blocks"> & {
  developerId: string;
  minutesToCenter: number | null;
  createdAt: string;
  photos: CatalogPhoto[];
  blocks: CatalogBlock[];
};

/** Программа застройщика и на какие блоки она (block_ids — только блоки на сайте). */
export type CatalogProgram = {
  id: string;
  program: CalcProgram;
  /** Банк рассрочки через банк и ипотеки — чип оплаты на карточке. */
  bank: LocalizedText | null;
  blocksScope: "all" | "selected";
  blockIds: string[];
};

export type CatalogDeveloper = { id: string; slug: string; name: string; programs: CatalogProgram[] };

export type SiteCatalog = { rate: ExchangeRate | null; developers: CatalogDeveloper[]; complexes: CatalogComplex[] };

const toNumber = (value: NumberLike | null): number | null => (value === null ? null : Number(value));

function offerFrom(record: OfferRecord): CatalogOffer {
  return {
    rooms: record.rooms,
    available: record.available,
    free: record.free,
    areaFrom: toNumber(record.area_from),
    priceFrom: toNumber(record.price_from),
    priceTo: toNumber(record.price_to),
    pricePerM2From: toNumber(record.price_per_m2_from),
  };
}

function blockFrom(record: BlockRecord): CatalogBlock {
  const { build_status, deadline_year, deadline_quarter, floors_total, offers, ...rest } = record;
  return {
    ...rest,
    buildStatus: build_status,
    deadline: deadline_year && deadline_quarter ? { year: deadline_year, quarter: deadline_quarter } : null,
    floorsTotal: floors_total,
    offers: offers.map(offerFrom),
  };
}

function photoFrom(record: PhotoRecord): CatalogPhoto {
  const { focus_x, focus_y, ...rest } = record;
  return { ...rest, focus: { x: Number(focus_x), y: Number(focus_y) } };
}

/**
 * Размытое превью — только у обложки и следующего кадра (первое листание): остальные кадры карточки
 * грузятся после первого касания галереи. Каталог уходит в браузер целиком, а превью — ~500 байт на
 * фото: с 30 ЖК по 5 фото это ~75 КБ лишнего на каждой странице с каталогом.
 */
const BLUR_PHOTOS = 2;

function complexFrom(record: ComplexRecord): CatalogComplex {
  const { developer_id, minutes_to_center, created_at, photos, blocks, ...rest } = record;
  return {
    ...rest,
    developerId: developer_id,
    minutesToCenter: minutes_to_center,
    createdAt: created_at,
    photos: photos.map((photo, index) => ({ ...photoFrom(photo), ...(index < BLUR_PHOTOS ? {} : { blur: null }) })),
    blocks: blocks.map(blockFrom),
  };
}

export function catalogFrom(record: SiteCatalogRecord): SiteCatalog {
  return {
    rate: rateFromRecord(record.rate),
    developers: record.developers.map((developer) => ({
      id: developer.id,
      slug: developer.slug,
      name: developer.name,
      programs: developer.programs.map((program) => ({
        id: program.id,
        program: programFromRecord(program),
        bank: program.bank,
        blocksScope: program.blocks_scope,
        blockIds: program.block_ids,
      })),
    })),
    complexes: record.complexes.map(complexFrom),
  };
}
