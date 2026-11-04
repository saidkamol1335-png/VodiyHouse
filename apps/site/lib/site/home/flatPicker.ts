import { convertMoney } from "@vh/shared/calc/money";
import {
  blockMatches,
  NO_FILTER,
  offerMatches,
  type CatalogFilter,
} from "@/lib/site/catalog/filter";
import { countMatchingFlats } from "@/lib/site/catalog/flats";
import { searchFromFilter } from "@/lib/site/catalog/params";
import { filterCatalog, matchingPriceUsd } from "@/lib/site/catalog/sort";
import type { CatalogComplex, CatalogDeveloper, SiteCatalog } from "@/lib/site/catalog/records";
import { maxMonthsOf } from "@vh/shared/calc/programs";

/** Вкладки секции «Выберите свою квартиру» (PLAN §10, п. 47): 1, 2, 3 комнаты и 4+ (как чип каталога). */
export const FLAT_ROOMS = [1, 2, 3, 4] as const;
export type FlatRooms = (typeof FLAT_ROOMS)[number];

export type FlatDeadline =
  { kind: "built" } | { kind: "until"; year: number; quarter: number } | null;

export type FlatTab = {
  rooms: FlatRooms;
  /** Свободных квартир; partial — у части типов наличие без числа («не меньше»). */
  flats: number;
  partial: boolean;
  complexes: number;
  areaFrom: number | null;
  priceUsd: number | null;
  /** Та же цена в сумах по курсу ЦБ; null — курса нет. */
  priceUzs: number | null;
  perM2Usd: number | null;
  /** Ближайшая сдача среди подходящих блоков; «сдан» — есть сданный блок. */
  deadline: FlatDeadline;
  installmentMonths: number | null;
  /** Ссылка в каталог с фильтром по комнатам: «?rooms=2». */
  search: string;
};

const min = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.min(a, b);

/** Рассрочка до N мес. по программам, что действуют на этот блок (не на весь ЖК). */
function blockInstallmentMonths(
  developer: CatalogDeveloper | undefined,
  blockId: string,
): number | null {
  const months = (developer?.programs ?? [])
    .filter((entry) => entry.program.type === "installment")
    .filter((entry) => entry.blocksScope === "all" || entry.blockIds.includes(blockId))
    .map((entry) => maxMonthsOf(entry.program));
  return months.length > 0 ? Math.max(...months) : null;
}

type Facts = Pick<FlatTab, "priceUsd" | "areaFrom" | "perM2Usd" | "installmentMonths" | "deadline">;

const earlier = (
  a: { year: number; quarter: number },
  b: { year: number; quarter: number } | null,
) => !b || a.year * 4 + a.quarter < b.year * 4 + b.quarter;

/** Площадь, цены, рассрочка и ближайшая сдача — только по подходящим блокам и типам квартир. */
function tabFacts(complexes: CatalogComplex[], catalog: SiteCatalog, filter: CatalogFilter): Facts {
  const facts: Facts = {
    priceUsd: null,
    areaFrom: null,
    perM2Usd: null,
    installmentMonths: null,
    deadline: null,
  };
  let built = false;
  let nearest: { year: number; quarter: number } | null = null;
  for (const complex of complexes) {
    facts.priceUsd = min(facts.priceUsd, matchingPriceUsd(complex, catalog, filter));
    const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
    for (const block of complex.blocks) {
      if (!blockMatches(block, developer, filter, catalog.rate)) continue;
      const offers = block.offers.filter((offer) =>
        offerMatches(offer, block.currency, filter, catalog.rate),
      );
      if (offers.length === 0) continue;
      const months = blockInstallmentMonths(developer, block.id);
      if (months !== null) facts.installmentMonths = Math.max(facts.installmentMonths ?? 0, months);
      if (block.buildStatus === "delivered") built = true;
      else if (block.deadline && earlier(block.deadline, nearest)) nearest = block.deadline;
      for (const offer of offers) {
        facts.areaFrom = min(facts.areaFrom, offer.areaFrom);
        const perM2 = offer.pricePerM2From;
        if (perM2 !== null)
          facts.perM2Usd = min(
            facts.perM2Usd,
            convertMoney(perM2, block.currency, "USD", catalog.rate),
          );
      }
    }
  }
  facts.deadline = built ? { kind: "built" } : nearest ? { kind: "until", ...nearest } : null;
  return facts;
}

/**
 * Цифры вкладки — тем же фильтром, что каталог (filterCatalog, countMatchingFlats, matchingPriceUsd):
 * только опубликованные ЖК и полные планировки, «скоро» не входят. Нет квартир — вкладки нет.
 */
export function flatTab(catalog: SiteCatalog, rooms: FlatRooms): FlatTab | null {
  const filter: CatalogFilter = { ...NO_FILTER, rooms: [rooms] };
  const complexes = filterCatalog(catalog, filter);
  const { flats, partial } = countMatchingFlats(complexes, catalog, filter);
  if (flats === 0 && !partial) return null;
  const facts = tabFacts(complexes, catalog, filter);
  return {
    ...facts,
    rooms,
    flats,
    partial,
    complexes: complexes.length,
    priceUzs:
      facts.priceUsd === null ? null : convertMoney(facts.priceUsd, "USD", "UZS", catalog.rate),
    search: searchFromFilter(filter),
  };
}

/** Вкладки с квартирами и кадрами (кадров для типа нет — вкладки нет). */
export function flatTabs(catalog: SiteCatalog, framed: (rooms: FlatRooms) => boolean): FlatTab[] {
  return FLAT_ROOMS.flatMap((rooms) => {
    if (!framed(rooms)) return [];
    const tab = flatTab(catalog, rooms);
    return tab ? [tab] : [];
  });
}
