import { convertMoney, type Currency, type ExchangeRate } from "@/lib/calc/money";
import type { ProgramType } from "@/lib/calc/programs";
import type { CatalogBlock, CatalogComplex, CatalogDeveloper, CatalogOffer, SiteCatalog } from "./records";

// Фильтр каталога в браузере (решение фазы 3 «Данные», логика — мокап jkMatch): ЖК подходит, если
// хоть один его блок подходит целиком — отделка, срок, все выбранные способы оплаты и хоть один
// свободный тип комнат в нужной цене. Цены фильтра — в $ (мокап «Цена квартиры, $»): блок в сумах
// сравнивается через курс, без курса цену не отсекает, а в сортировке по цене идёт последним (Ф6).
// «Цена от … до …» — по самой дешёвой и самой дорогой свободной квартире типа.

/** Чипы комнат мокапа: 0 — студия, 4 — «4+». */
export const ROOM_CHIPS = [0, 1, 2, 3, 4] as const;
export const PAYMENT_KINDS = ["full", "inst", "bank", "mort"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
export const CATALOG_SORTS = ["rec", "cheap", "exp", "dl"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
/** «Любой», «Сдан» или «до года» (сданный блок подходит к любому году). */
export type DeadlineFilter = "any" | "built" | number;

const PROGRAM_TYPE: Record<PaymentKind, ProgramType> = {
  full: "full",
  inst: "installment",
  bank: "bank_installment",
  mort: "mortgage",
};

export type CatalogFilter = {
  rooms: number[];
  priceMin: number | null;
  priceMax: number | null;
  locations: string[];
  developers: string[];
  deadline: DeadlineFilter;
  payments: PaymentKind[];
  finishings: string[];
  sort: CatalogSort;
};

export const NO_FILTER: CatalogFilter = {
  rooms: [],
  priceMin: null,
  priceMax: null,
  locations: [],
  developers: [],
  deadline: "any",
  payments: [],
  finishings: [],
  sort: "rec",
};

const roomChip = (rooms: number) => Math.min(rooms, 4);

/** Цена в $; null — блок в сумах, а курса нет. */
const inUsd = (amount: number, currency: Currency, rate: ExchangeRate | null) =>
  convertMoney(amount, currency, "USD", rate);

function priceFits(offer: CatalogOffer, currency: Currency, filter: CatalogFilter, rate: ExchangeRate | null) {
  if (filter.priceMin === null && filter.priceMax === null) return true;
  // «Цена по запросу» в диапазон не попадает: показать её в «до $50 000» было бы обманом.
  if (offer.priceFrom === null) return false;
  const from = inUsd(offer.priceFrom, currency, rate);
  const to = inUsd(offer.priceTo ?? offer.priceFrom, currency, rate);
  if (from === null || to === null) return true;
  return (filter.priceMax === null || from <= filter.priceMax) && (filter.priceMin === null || to >= filter.priceMin);
}

export function offerMatches(offer: CatalogOffer, currency: Currency, filter: CatalogFilter, rate: ExchangeRate | null) {
  if (!offer.available) return false;
  if (filter.rooms.length > 0 && !filter.rooms.includes(roomChip(offer.rooms))) return false;
  return priceFits(offer, currency, filter, rate);
}

/** Типы программ, действующих для блока: на весь ЖК или на этот блок. */
export function blockProgramTypes(developer: CatalogDeveloper | undefined, blockId: string): Set<ProgramType> {
  const programs = developer?.programs ?? [];
  return new Set(
    programs
      .filter((entry) => entry.blocksScope === "all" || entry.blockIds.includes(blockId))
      .map((entry) => entry.program.type),
  );
}

function deadlineFits(block: CatalogBlock, deadline: DeadlineFilter) {
  if (deadline === "any") return true;
  if (block.buildStatus === "delivered") return true;
  if (deadline === "built") return false;
  return block.deadline !== null && block.deadline.year <= deadline;
}

export function blockMatches(
  block: CatalogBlock,
  developer: CatalogDeveloper | undefined,
  filter: CatalogFilter,
  rate: ExchangeRate | null,
) {
  if (filter.finishings.length > 0 && !filter.finishings.includes(block.finishing?.slug ?? "")) return false;
  if (!deadlineFits(block, filter.deadline)) return false;
  const types = blockProgramTypes(developer, block.id);
  if (!filter.payments.every((kind) => types.has(PROGRAM_TYPE[kind]))) return false;
  return block.offers.some((offer) => offerMatches(offer, block.currency, filter, rate));
}

export function complexMatches(complex: CatalogComplex, catalog: SiteCatalog, filter: CatalogFilter) {
  const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
  if (filter.locations.length > 0 && !filter.locations.includes(complex.location?.slug ?? "")) return false;
  if (filter.developers.length > 0 && !filter.developers.includes(developer?.slug ?? "")) return false;
  return complex.blocks.some((block) => blockMatches(block, developer, filter, catalog.rate));
}
