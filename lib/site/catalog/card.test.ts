import { describe, expect, it } from "vitest";
import { cardDeadline, cardPays, cardPrice, cardRoomTypes } from "./card";
import type { CatalogBlock, CatalogComplex, CatalogDeveloper, CatalogOffer, SiteCatalog } from "./records";

const offer = (rooms: number, area: number, price: number | null, free: number | null = 2): CatalogOffer => ({
  rooms,
  available: free === null || free > 0,
  free,
  areaFrom: area,
  priceFrom: price,
  priceTo: price,
  pricePerM2From: price === null ? null : price / area,
});

const block = (id: string, patch: Partial<CatalogBlock>): CatalogBlock => ({
  id,
  name: id,
  currency: "USD",
  buildStatus: "building",
  deadline: { year: 2027, quarter: 4 },
  floorsTotal: 12,
  finishing: null,
  offers: [],
  ...patch,
});

const complex = (blocks: CatalogBlock[]): CatalogComplex => ({
  id: "c",
  slug: "c",
  name: { ru: "C", uz: "C" },
  class: "comfort",
  sort: 0,
  developerId: "d",
  location: null,
  address: null,
  landmark: null,
  minutesToCenter: null,
  checked: { permit: null, land: null, visit: null },
  createdAt: "2026-10-01",
  photos: [],
  blocks,
});

const developer: CatalogDeveloper = {
  id: "d",
  slug: "d",
  name: "D",
  programs: [
    { id: "f", program: { type: "full" }, bank: null, blocksScope: "all", blockIds: [] },
    {
      id: "i",
      program: { type: "installment", method: "tiers", tiers: [{ minDownPct: 30, minMonths: 1, maxMonths: 36 }], presetMonths: [12, 24, 36], allowCustomMonths: true, overMaxBehavior: "block" },
      bank: null,
      blocksScope: "selected",
      blockIds: ["b"],
    },
    {
      id: "m",
      program: { type: "mortgage", method: "annuity", minDownPct: 20, terms: [{ months: 120, ratePct: 17 }], fees: [], currency: "UZS" },
      bank: { ru: "Ipoteka Bank", uz: "Ipoteka Bank" },
      blocksScope: "selected",
      blockIds: ["other-complex-block"],
    },
  ],
};

describe("карточка ЖК", () => {
  const a = block("a", { buildStatus: "delivered", deadline: null, offers: [offer(1, 42.5, 31000, 4), offer(2, 67.1, 52000, 0)] });
  const b = block("b", { offers: [offer(1, 44.1, 33000, null), offer(3, 84.3, 70000, 3)] });

  it("типы комнат по всем блокам: площадь «от», свободно — сумма, где-то неизвестно — null", () => {
    expect(cardRoomTypes(complex([a, b]))).toEqual([
      { rooms: 1, areaFrom: 42.5, available: true, free: null },
      { rooms: 2, areaFrom: null, available: false, free: 0 },
      { rooms: 3, areaFrom: 84.3, available: true, free: 3 },
    ]);
  });

  it("срок: всё сдано — «Сдан»; часть сдана — «есть сданные · остальные до …»", () => {
    expect(cardDeadline(complex([a]))).toEqual({ kind: "built" });
    expect(cardDeadline(complex([a, b]))).toEqual({ kind: "until", year: 2027, quarter: 4, partlyBuilt: true });
    expect(cardDeadline(complex([b]))).toMatchObject({ partlyBuilt: false });
  });

  it("оплата: «100%» без скидки, рассрочка до 36 мес. (на блок b), банк чужого ЖК — не здесь", () => {
    expect(cardPays(complex([a, b]), developer)).toEqual({ full: true, installmentMonths: 36, banks: [] });
  });

  it("цена «от» — у самого дешёвого блока, в его валюте; сумы — через курс", () => {
    const catalog: SiteCatalog = { rate: { usdUzs: 12500, date: "2026-10-25", source: "cbu" }, developers: [developer], complexes: [] };
    const sums = block("s", { currency: "UZS", offers: [offer(1, 40, 350_000_000)] });
    const price = cardPrice(complex([b, sums]), catalog);
    expect(price).toMatchObject({ amount: 350_000_000, currency: "UZS" });
    expect(cardPrice(complex([a, b]), catalog)).toMatchObject({ amount: 31000, currency: "USD" });
    expect(cardPrice(complex([]), catalog)).toBeNull();
  });
});
