import { cardRoomTypes, type CardRoomType } from "../catalog/card";
import { NO_FILTER, offerMatches, type CatalogFilter } from "../catalog/filter";
import type { CatalogComplex, SiteCatalog } from "../catalog/records";
import { searchFromFilter } from "../catalog/params";
import { filterCatalog } from "../catalog/sort";

// Цифры главной (шаг 3.9, мокап: .hero__stats, .vf__found, .avmini) — из того же ответа каталога,
// что и лента: страница статичная, отдельных запросов к базе нет. «Свободно» без числа у типа
// (наличие без списка квартир) в сумму не входит — сумма тогда «не меньше».

export type HomeStats = { complexes: number; developers: number; flats: number; partial: boolean };

/** Свободные квартиры ЖК: сумма по типам с числом; partial — у части типов числа нет. */
function freeOf(complex: CatalogComplex): { free: number; partial: boolean } {
  let free = 0;
  let partial = false;
  for (const block of complex.blocks) {
    for (const offer of block.offers) {
      if (offer.free === null) partial ||= offer.available;
      else free += offer.free;
    }
  }
  return { free, partial };
}

export function homeStats(catalog: SiteCatalog): HomeStats {
  const free = catalog.complexes.map(freeOf);
  return {
    complexes: catalog.complexes.length,
    developers: new Set(catalog.complexes.map((complex) => complex.developerId)).size,
    flats: free.reduce((sum, item) => sum + item.free, 0),
    partial: free.some((item) => item.partial),
  };
}

/** Пример запроса видоискателя (мокап vfQuery): «2-комн. до $45 000». */
export const HERO_QUERY: CatalogFilter = { ...NO_FILTER, rooms: [2], priceMax: 45_000 };

export type HeroFound = { complexes: number; flats: number; partial: boolean; search: string };

/**
 * «Найдено сейчас: 1 ЖК · 9 кв.» — по фильтру каталога; квартиры — свободные подходящего типа.
 * partial — у части подходящих типов наличие без списка квартир: число тогда «не меньше».
 */
export function heroFound(catalog: SiteCatalog, filter: CatalogFilter = HERO_QUERY): HeroFound {
  const found = filterCatalog(catalog, filter);
  let flats = 0;
  let partial = false;
  for (const complex of found) {
    for (const block of complex.blocks) {
      for (const offer of block.offers.filter((item) => offerMatches(item, block.currency, filter, catalog.rate))) {
        if (offer.free === null) partial ||= offer.available;
        else flats += offer.free;
      }
    }
  }
  return { complexes: found.length, flats, partial, search: searchFromFilter(filter) };
}

/** «Остатки по каждому ЖК» (мокап .avmini): первый ЖК ленты и его типы с числом свободных. */
export function availabilitySample(catalog: SiteCatalog): { complex: CatalogComplex; types: CardRoomType[] } | null {
  for (const complex of catalog.complexes) {
    const types = cardRoomTypes(complex).filter((type) => type.free !== null).slice(0, 4);
    if (types.length > 0) return { complex, types };
  }
  return null;
}
