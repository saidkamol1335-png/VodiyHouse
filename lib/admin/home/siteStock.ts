import type { ActionGuardCode } from "../session";
import type { ComplexListRow } from "../complexes/list";
import {
  EMPTY_STOCK,
  roomGroupOf,
  stockByComplex,
  type ComplexStock,
  type RoomAvailabilityRecord,
  type RoomGroup,
} from "../complexes/stock";

// «Остатки по ЖК» на главной кабинета (шаг 13): только ЖК на сайте (Г2 A). Остатки по комнатам —
// тем же правилом, что строка списка «ЖК» (stockByComplex); для раскрытия строки (Г3 B) — «цена
// от» и «площадь от» по типам и свободные по блокам. Данные — функции сайта room_availability и
// block_availability: сотрудник видит те же цифры, что клиент.

export type Currency = "USD" | "UZS";

const CURRENCIES: readonly Currency[] = ["USD", "UZS"];

/** Строка room_availability целиком: numeric приходит числом (PostgREST) или строкой (PGlite). */
export type RoomOfferRecord = RoomAvailabilityRecord & {
  currency: string;
  area_from: number | string | null;
  price_from: number | string | null;
};

export type BlockAvailabilityRecord = {
  complex_id: string;
  block_id: string;
  name: string;
  /** null — у блока нет списка квартир. */
  free_count: number | null;
  available: boolean;
};

export type Price = { amount: number; currency: Currency };

/** Тип в раскрытии: free null — «по планировкам»; цена «от» — в каждой валюте блоков. */
export type RoomOffer = {
  group: RoomGroup;
  free: number | null;
  areaFrom: number | null;
  prices: Price[];
};

export type BlockStock = { id: string; name: string; free: number | null; available: boolean };

export type SiteStockComplex = {
  id: string;
  name: string;
  locationName: string | null;
  developerName: string;
  stock: ComplexStock;
  offers: RoomOffer[];
  blocks: BlockStock[];
  /** Свободные без планировки: в блоках они есть, в типах (и в «свободно N») — нет. */
  unassigned: number;
};

export type SiteStock = { complexes: SiteStockComplex[] };

export type SiteComplex = Pick<ComplexListRow, "id" | "name" | "locationName" | "developerName">;

export type SiteStockError = ActionGuardCode | "unavailable";

export type SiteStockResult =
  { status: "done"; stock: SiteStock } | { status: "error"; error: SiteStockError };

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const isCurrency = (value: string): value is Currency => CURRENCIES.includes(value as Currency);

/** Минимальная «цена от» по каждой валюте: у типа бывают блоки в долларах и в сумах. */
function pricesOf(records: readonly RoomOfferRecord[]): Price[] {
  const byCurrency = new Map<Currency, number>();
  for (const record of records) {
    const amount = numberOrNull(record.price_from);
    if (amount === null || !isCurrency(record.currency)) continue;
    byCurrency.set(record.currency, Math.min(byCurrency.get(record.currency) ?? amount, amount));
  }
  return CURRENCIES.filter((currency) => byCurrency.has(currency)).map((currency) => ({
    currency,
    amount: byCurrency.get(currency)!,
  }));
}

function areaFrom(records: readonly RoomOfferRecord[]): number | null {
  const areas = records.map((record) => numberOrNull(record.area_from));
  const known = areas.filter((area): area is number => area !== null);
  return known.length > 0 ? Math.min(...known) : null;
}

/** Типы — ровно группы строки (одно правило «свободно»), «от» — по доступным записям группы. */
function offersOf(stock: ComplexStock, records: readonly RoomOfferRecord[]): RoomOffer[] {
  return stock.groups.map(({ group, free }) => {
    const offered = records.filter(
      (record) => record.available && roomGroupOf(record.rooms) === group,
    );
    return { group, free, areaFrom: areaFrom(offered), prices: pricesOf(offered) };
  });
}

function unassignedOf(stock: ComplexStock, blocks: readonly BlockStock[]): number {
  // С «по планировкам» сумма типов неполная — разницу не посчитать.
  if (stock.partial) return 0;
  const listed = blocks.reduce((sum, block) => sum + (block.free ?? 0), 0);
  return Math.max(0, listed - stock.free);
}

function groupBy<T extends { complex_id: string }>(records: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    grouped.set(record.complex_id, [...(grouped.get(record.complex_id) ?? []), record]);
  }
  return grouped;
}

const blockStockOf = (record: BlockAvailabilityRecord): BlockStock => ({
  id: record.block_id,
  name: record.name,
  free: record.free_count,
  available: record.available,
});

export function siteStockFrom(
  complexes: readonly SiteComplex[],
  rooms: readonly RoomOfferRecord[],
  blocks: readonly BlockAvailabilityRecord[],
): SiteStock {
  const stocks = stockByComplex(rooms);
  const roomsOf = groupBy(rooms);
  const blocksOf = groupBy(blocks);
  return {
    complexes: complexes.map((complex) => {
      const stock = stocks.get(complex.id) ?? EMPTY_STOCK;
      const blockStock = (blocksOf.get(complex.id) ?? []).map(blockStockOf);
      return {
        id: complex.id,
        name: complex.name.ru,
        locationName: complex.locationName,
        developerName: complex.developerName,
        stock,
        offers: offersOf(stock, roomsOf.get(complex.id) ?? []),
        blocks: blockStock,
        unassigned: unassignedOf(stock, blockStock),
      };
    }),
  };
}

/** Итог в шапке панели (Г1 B): «176» или «176+», если у части типов нет числа. */
export function siteStockTotal(stock: SiteStock): { free: number; partial: boolean } {
  return {
    free: stock.complexes.reduce((sum, complex) => sum + complex.stock.free, 0),
    partial: stock.complexes.some((complex) => complex.stock.partial),
  };
}
