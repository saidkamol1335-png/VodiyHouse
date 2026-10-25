import { cheapest } from "@/lib/site/catalog/card";
import type { ComplexPage } from "./model";

// «Наличие квартир» (мокап .avl, задача 6): по типу комнат — площадь и цена «от», свободно по
// блокам и всего. Цена — у самого дешёвого блока в его валюте (Ф6). null у «свободно» — у блока нет
// списка квартир: тип «есть в продаже», но сколько — неизвестно (PLAN §3.1).

export type StockByBlock = {
  blockId: string;
  blockName: string;
  free: number | null;
  available: boolean;
};

export type StockRow = {
  rooms: number;
  available: boolean;
  areaFrom: number | null;
  price: { amount: number; currency: "USD" | "UZS" } | null;
  free: number | null;
  blocks: StockByBlock[];
};

function sumFree(entries: readonly StockByBlock[]): number | null {
  let total = 0;
  for (const entry of entries) {
    if (!entry.available) continue;
    if (entry.free === null) return null;
    total += entry.free;
  }
  return total;
}

export function stockRows(page: ComplexPage): StockRow[] {
  const rooms = [...new Set(page.blocks.flatMap((block) => block.offers.map((offer) => offer.rooms)))].sort((a, b) => a - b);
  return rooms.map((count) => {
    const offers = page.blocks.flatMap((block) => {
      const offer = block.offers.find((item) => item.rooms === count);
      return offer ? [{ block, offer }] : [];
    });
    const blocks = offers.map(({ block, offer }) => ({
      blockId: block.id,
      blockName: block.name,
      free: offer.free,
      available: offer.available,
    }));
    const areas = offers.flatMap(({ offer }) => (offer.available && offer.areaFrom !== null ? [offer.areaFrom] : []));
    const prices = offers.flatMap(({ block, offer }) =>
      offer.available && offer.priceFrom !== null ? [{ amount: offer.priceFrom, currency: block.currency }] : [],
    );
    const available = offers.some(({ offer }) => offer.available);
    return {
      rooms: count,
      available,
      areaFrom: areas.length > 0 ? Math.min(...areas) : null,
      price: cheapest(prices, page.catalog.rate),
      free: available ? sumFree(blocks) : 0,
      blocks,
    };
  });
}

/** «41 в продаже сейчас · Бл. A: 12 · Бл. B: 29»: свободно по блокам (null — без списка квартир). */
export function freeByBlock(page: ComplexPage): { name: string; free: number | null }[] {
  return page.blocks.map((block) => ({ name: block.name, free: block.free }));
}
