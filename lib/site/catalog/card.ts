import type { LocalizedText } from "@/lib/contacts";
import { convertMoney, type Currency } from "@/lib/calc/money";
import { maxMonthsOf } from "@/lib/calc/programs";
import { blockPaymentFrom } from "./payment";
import type { CatalogBlock, CatalogComplex, CatalogDeveloper, SiteCatalog } from "./records";

// Карточка ЖК каталога (мокап .jc): числа и названия — строки собирает компонент из messages.
// Без скидок (PLAN §3.13): «100% оплата» — без процента, бейджей акций нет.

export type CardRoomType = { rooms: number; areaFrom: number | null; available: boolean; free: number | null };

/** «Сдан»; «4 кв. 2027»; «есть сданные · остальные до 4 кв. 2027»; срока нет — null. */
export type CardDeadline =
  | { kind: "built" }
  | { kind: "until"; year: number; quarter: number; partlyBuilt: boolean }
  | null;

export type CardPays = { full: boolean; installmentMonths: number | null; banks: LocalizedText[] };

export type CardPrice = { amount: number; currency: Currency; perM2: number | null; payment: number | null };

/** Тип комнат по всем блокам: площадь «от», свободно (null — где-то число неизвестно). */
export function cardRoomTypes(complex: CatalogComplex): CardRoomType[] {
  const byRooms = new Map<number, CardRoomType>();
  for (const offer of complex.blocks.flatMap((block) => block.offers)) {
    const seen = byRooms.get(offer.rooms) ?? { rooms: offer.rooms, areaFrom: null, available: false, free: 0 };
    const area = offer.available ? offer.areaFrom : null;
    byRooms.set(offer.rooms, {
      rooms: offer.rooms,
      areaFrom: area === null ? seen.areaFrom : Math.min(seen.areaFrom ?? area, area),
      available: seen.available || offer.available,
      free: seen.free === null || offer.free === null ? null : seen.free + offer.free,
    });
  }
  return [...byRooms.values()].sort((a, b) => a.rooms - b.rooms);
}

export function cardDeadline(complex: CatalogComplex): CardDeadline {
  const building = complex.blocks.filter((block) => block.buildStatus !== "delivered");
  if (complex.blocks.length > 0 && building.length === 0) return { kind: "built" };
  const latest = building
    .flatMap((block) => (block.deadline ? [block.deadline] : []))
    .sort((a, b) => b.year * 4 + b.quarter - (a.year * 4 + a.quarter))[0];
  if (!latest) return null;
  return { kind: "until", ...latest, partlyBuilt: building.length < complex.blocks.length };
}

export function cardPays(complex: CatalogComplex, developer: CatalogDeveloper | undefined): CardPays {
  const blockIds = complex.blocks.map((block) => block.id);
  const programs = (developer?.programs ?? []).filter(
    (entry) => entry.blocksScope === "all" || entry.blockIds.some((id) => blockIds.includes(id)),
  );
  const installments = programs.filter((entry) => entry.program.type === "installment");
  const banks = programs.flatMap((entry) => (entry.bank ? [entry.bank] : []));
  return {
    full: programs.some((entry) => entry.program.type === "full"),
    installmentMonths: installments.length > 0 ? Math.max(...installments.map((entry) => maxMonthsOf(entry.program))) : null,
    banks: banks.filter((bank, index) => banks.findIndex((other) => other.ru === bank.ru) === index),
  };
}

function blockMinPrice(block: CatalogBlock): number | null {
  const prices = block.offers.flatMap((offer) => (offer.available && offer.priceFrom !== null ? [offer.priceFrom] : []));
  return prices.length > 0 ? Math.min(...prices) : null;
}

export type Money = { amount: number; currency: Currency };

/** Дешевле ли a, чем b: одна валюта — по сумме; разные — через курс; без курса — доллары первыми. */
function cheaper(a: Money, b: Money, rate: SiteCatalog["rate"]): boolean {
  if (a.currency === b.currency) return a.amount < b.amount;
  const usdA = convertMoney(a.amount, a.currency, "USD", rate);
  const usdB = convertMoney(b.amount, b.currency, "USD", rate);
  if (usdA === null || usdB === null) return a.currency === "USD";
  return usdA < usdB;
}

/** Самая дешёвая из цен в разных валютах (Ф6) — для карточки каталога и «Других ЖК» страницы ЖК. */
export function cheapest<T extends Money>(prices: readonly T[], rate: SiteCatalog["rate"]): T | null {
  let best: T | null = null;
  for (const price of prices) if (!best || cheaper(price, best, rate)) best = price;
  return best;
}

/** Цена «от» — у самого дешёвого блока, в его валюте (Ф6). */
export function cardPrice(complex: CatalogComplex, catalog: SiteCatalog): CardPrice | null {
  const priced = complex.blocks.flatMap((block) => {
    const amount = blockMinPrice(block);
    return amount === null ? [] : [{ block, amount, currency: block.currency }];
  });
  const best = cheapest(priced, catalog.rate);
  if (!best) return null;
  const perM2 = best.block.offers.flatMap((offer) => (offer.available && offer.pricePerM2From !== null ? [offer.pricePerM2From] : []));
  return {
    amount: best.amount,
    currency: best.block.currency,
    perM2: perM2.length > 0 ? Math.min(...perM2) : null,
    payment: blockPaymentFrom(catalog, complex.developerId, best.block),
  };
}

