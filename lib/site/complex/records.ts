import type { LocalizedText } from "@/lib/contacts";
import type { Currency } from "@/lib/calc/money";
import type { RateRecord, SiteProgramRecord } from "@/lib/calc/records";
import {
  catalogFrom,
  type BlockRecord,
  type CatalogBlock,
  type CatalogComplex,
  type CatalogPhoto,
  type ComplexRecord,
  type PhotoRecord,
  type SiteCatalog,
} from "@/lib/site/catalog/records";
import type { ComplexBlock, ComplexDeveloper, ComplexLayout, ComplexPage } from "./model";
import { nearbyFrom } from "./nearby";

// Запись site_complex() (20261025180000_complex_page.sql) → страница ЖК. Блоки, фото и программы —
// те же преобразователи, что у каталога: «Платёж от», срок и цена «от» считаются одинаково на
// карточке и на странице (lib/site/catalog/card.ts). numeric приходит и строкой.

export type NumberLike = number | string;

export type HistoryRecord = {
  from_year: number;
  from_quarter: number;
  to_year: number;
  to_quarter: number;
  changed_on: string;
};

export type PriceIncludeRecord = { item: LocalizedText; included: boolean; price?: number };

export type PageBlockRecord = BlockRecord & {
  progress_pct: number | null;
  floors_built: number | null;
  finishing: (BlockRecord["finishing"] & { description: LocalizedText | null }) | null;
  cadastre: "done" | "in_progress" | "after_delivery" | null;
  cadastre_expected_on: string | null;
  price_includes: PriceIncludeRecord[];
  free: number | null;
  deadline_history: HistoryRecord[];
};

export type LayoutRecord = {
  id: string;
  block_id: string;
  rooms: number;
  area: NumberLike;
  free: number | null;
  available: boolean;
  price_from: NumberLike | null;
  floor_from: number | null;
  floor_to: number | null;
  drawing: PhotoRecord | null;
};

export type PageComplexRecord = Pick<ComplexRecord, "id" | "slug" | "name" | "class" | "location" | "address" | "landmark" | "minutes_to_center" | "checked"> & {
  status: "draft" | "published" | "hidden" | "archived";
  short_description: LocalizedText | null;
  house_type: "monolith" | "brick" | "frame" | null;
  ceiling_height: NumberLike | null;
  parking: "underground" | "ground" | "mixed" | null;
  lat: NumberLike | null;
  lng: NumberLike | null;
  nearby: unknown;
  stock_updated_at: string | null;
};

export type ComplexPageRecord = {
  rate: RateRecord | null;
  complex: PageComplexRecord;
  developer: {
    id: string;
    slug: string;
    name: string;
    about: LocalizedText | null;
    founded_year: number | null;
    delivered_checked_at: string | null;
    logo: PhotoRecord | null;
    complexes_built: number;
    complexes_building: number;
    programs: SiteProgramRecord[];
  };
  photos: PhotoRecord[];
  blocks: PageBlockRecord[];
  layouts: LayoutRecord[];
  documents: {
    slug: string;
    name: LocalizedText;
    hint: LocalizedText | null;
    checked_on: string;
  }[];
  videos: { youtube_id: string; title: LocalizedText | null }[];
  details: { slug: string; name: LocalizedText; text: LocalizedText; photo: PhotoRecord | null }[];
  others: {
    slug: string;
    name: LocalizedText;
    location: LocalizedText | null;
    photo: PhotoRecord | null;
    prices: { currency: Currency; price_from: NumberLike }[];
  }[];
};

const toNumber = (value: NumberLike | null): number | null => (value === null ? null : Number(value));

function photoFrom(record: PhotoRecord | null): CatalogPhoto | null {
  if (!record) return null;
  const { focus_x, focus_y, ...rest } = record;
  return { ...rest, focus: { x: Number(focus_x), y: Number(focus_y) } };
}

function blockFrom(record: PageBlockRecord, catalogBlock: CatalogBlock): ComplexBlock {
  return {
    ...catalogBlock,
    progressPct: record.progress_pct,
    floorsBuilt: record.floors_built,
    finishingHint: record.finishing?.description ?? null,
    cadastre: record.cadastre,
    cadastreExpectedOn: record.cadastre_expected_on,
    priceIncludes: record.price_includes,
    free: record.free,
    history: record.deadline_history.map((entry) => ({
      from: { year: entry.from_year, quarter: entry.from_quarter },
      to: { year: entry.to_year, quarter: entry.to_quarter },
      changedOn: entry.changed_on,
    })),
  };
}

function layoutFrom(record: LayoutRecord): ComplexLayout {
  return {
    id: record.id,
    blockId: record.block_id,
    rooms: record.rooms,
    area: Number(record.area),
    free: record.free,
    available: record.available,
    priceFrom: toNumber(record.price_from),
    floors: record.floor_from !== null && record.floor_to !== null ? { from: record.floor_from, to: record.floor_to } : null,
    drawing: photoFrom(record.drawing),
  };
}

function developerFrom(record: ComplexPageRecord["developer"]): ComplexDeveloper {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    about: record.about,
    foundedYear: record.founded_year,
    deliveredCheckedAt: record.delivered_checked_at,
    logo: photoFrom(record.logo),
    built: Number(record.complexes_built),
    building: Number(record.complexes_building),
  };
}

function pointFrom(lat: NumberLike | null, lng: NumberLike | null) {
  return lat === null || lng === null ? null : { lat: Number(lat), lng: Number(lng) };
}

/** Блок в записи каталога — без полей страницы: они не должны утечь в модель карточки. */
function catalogBlockRecord(block: PageBlockRecord): BlockRecord {
  const { id, name, currency, build_status, deadline_year, deadline_quarter, floors_total, finishing, offers } = block;
  return {
    id,
    name,
    currency,
    build_status,
    deadline_year,
    deadline_quarter,
    floors_total,
    offers,
    finishing: finishing ? { slug: finishing.slug, name: finishing.name } : null,
  };
}

/** Каталог из одного ЖК: тот же преобразователь блоков, фото и программ, что у /novostroyki. */
function catalogOf(record: ComplexPageRecord): { catalog: SiteCatalog; complex: CatalogComplex } {
  const { complex, developer } = record;
  const { id, slug, name, class: complexClass, location, address, landmark, minutes_to_center, checked } = complex;
  const catalog = catalogFrom({
    rate: record.rate,
    developers: [
      {
        id: developer.id,
        slug: developer.slug,
        name: developer.name,
        programs: developer.programs,
      },
    ],
    complexes: [
      {
        id,
        slug,
        name,
        class: complexClass,
        location,
        address,
        landmark,
        minutes_to_center,
        checked,
        sort: 0,
        developer_id: developer.id,
        created_at: "",
        photos: record.photos,
        blocks: record.blocks.map(catalogBlockRecord),
      },
    ],
  });
  return { catalog: { ...catalog, complexes: [] }, complex: catalog.complexes[0]! };
}

export function complexPageFrom(record: ComplexPageRecord): ComplexPage {
  const { complex } = record;
  const { catalog, complex: catalogComplex } = catalogOf(record);
  return {
    id: complex.id,
    slug: complex.slug,
    name: complex.name,
    status: complex.status,
    class: complex.class,
    location: complex.location,
    address: complex.address,
    landmark: complex.landmark,
    checked: complex.checked,
    shortDescription: complex.short_description,
    houseType: complex.house_type,
    ceilingHeight: toNumber(complex.ceiling_height),
    parking: complex.parking,
    minutesToCenter: complex.minutes_to_center,
    point: pointFrom(complex.lat, complex.lng),
    nearby: nearbyFrom(complex.nearby),
    stockUpdatedAt: complex.stock_updated_at,
    developer: developerFrom(record.developer),
    photos: catalogComplex.photos,
    blocks: record.blocks.map((block, index) => blockFrom(block, catalogComplex.blocks[index]!)),
    layouts: record.layouts.map(layoutFrom),
    documents: record.documents.map(({ checked_on, ...rest }) => ({
      ...rest,
      checkedOn: checked_on,
    })),
    videos: record.videos.map((video) => ({ youtubeId: video.youtube_id, title: video.title })),
    details: record.details.map((detail) => ({ ...detail, photo: photoFrom(detail.photo) })),
    others: record.others.map((other) => ({
      ...other,
      photo: photoFrom(other.photo),
      prices: other.prices.map((price) => ({
        currency: price.currency,
        amount: Number(price.price_from),
      })),
    })),
    catalog,
  };
}
