import { describe, expect, it } from "vitest";
import { NO_FILTER, type CatalogFilter } from "./filter";
import type { CatalogBlock, CatalogComplex, CatalogOffer, SiteCatalog } from "./records";
import { filterCatalog, matchingPriceUsd } from "./sort";

const offer = (rooms: number, priceFrom: number | null, priceTo = priceFrom, available = true): CatalogOffer => ({
  rooms,
  available,
  free: available ? 3 : 0,
  areaFrom: 50,
  priceFrom,
  priceTo,
  pricePerM2From: null,
});

const block = (id: string, patch: Partial<CatalogBlock>): CatalogBlock => ({
  id,
  name: id,
  currency: "USD",
  buildStatus: "building",
  deadline: { year: 2027, quarter: 2 },
  floorsTotal: 12,
  finishing: { slug: "white-box", name: { ru: "White box", uz: "White box" } },
  offers: [],
  ...patch,
});

const complex = (slug: string, blocks: CatalogBlock[], developerId = "d1"): CatalogComplex => ({
  id: slug,
  slug,
  name: { ru: slug, uz: slug },
  class: "comfort",
  sort: 0,
  developerId,
  location: { slug: "fergana", kind: "city", name: { ru: "Фергана", uz: "Farg‘ona" } },
  address: null,
  landmark: null,
  minutesToCenter: null,
  checked: { permit: null, land: null, visit: null },
  createdAt: "2026-10-01",
  photos: [],
  blocks,
});

// A: 1-комн. дешёвая и 3-комн. дорогая — в РАЗНЫХ блоках; B — в сумах; C — сдан, 5-комн.
const catalog: SiteCatalog = {
  rate: { usdUzs: 12500, date: "2026-10-25", source: "cbu" },
  developers: [
    {
      id: "d1",
      slug: "sifat",
      name: "Sifat",
      programs: [
        { id: "p1", program: { type: "full" }, bank: null, blocksScope: "all", blockIds: [] },
        { id: "p2", program: { type: "full" }, bank: null, blocksScope: "selected", blockIds: ["a2"] },
      ],
    },
    { id: "d2", slug: "kamalak", name: "Kamalak", programs: [] },
  ],
  complexes: [
    complex("a", [block("a1", { offers: [offer(1, 40000, 52000)] }), block("a2", { offers: [offer(3, 90000, 120000)], deadline: { year: 2028, quarter: 1 } })]),
    complex("b", [block("b1", { currency: "UZS", offers: [offer(2, 750_000_000, 900_000_000)] })], "d2"),
    complex("c", [block("c1", { buildStatus: "delivered", deadline: null, finishing: null, offers: [offer(5, 200000), offer(1, null)] })]),
  ],
};

const run = (patch: Partial<CatalogFilter>) => filterCatalog(catalog, { ...NO_FILTER, ...patch }).map((c) => c.slug);

describe("фильтр каталога", () => {
  it("без фильтра — все ЖК в порядке руководителя", () => {
    expect(run({})).toEqual(["a", "b", "c"]);
  });

  it("комнаты и цена — внутри одного типа: 1-комн. до $45 000 есть только у A", () => {
    expect(run({ rooms: [1], priceMax: 45000 })).toEqual(["a"]);
    // 3-комн. есть у A, но дороже $60 000 — не дешевле «от».
    expect(run({ rooms: [3], priceMax: 60000 })).toEqual([]);
  });

  it("«4+» — и пятикомнатные; «цена от» — по самой дорогой свободной", () => {
    expect(run({ rooms: [4] })).toEqual(["c"]);
    expect(run({ priceMin: 110000 })).toEqual(["a", "c"]);
  });

  it("сумы — через курс (750 млн / 12 500 = $60 000); без курса цена их не отсекает", () => {
    expect(run({ priceMax: 59000, rooms: [2] })).toEqual([]);
    expect(run({ priceMax: 61000, rooms: [2] })).toEqual(["b"]);
    const noRate = { ...catalog, rate: null };
    expect(filterCatalog(noRate, { ...NO_FILTER, rooms: [2], priceMax: 1 }).map((c) => c.slug)).toEqual(["b"]);
  });

  it("«цена по запросу» в диапазон не попадает", () => {
    expect(run({ rooms: [1], priceMax: 1_000_000 })).toEqual(["a"]);
  });

  it("способ оплаты — у блока: программа «100%» на выбранный блок a2 и на весь ЖК", () => {
    expect(run({ payments: ["full"] })).toEqual(["a", "c"]);
    expect(run({ payments: ["full", "inst"] })).toEqual([]);
  });

  it("срок: «Сдан» — только сданные; «до 2027» — сданные и до 2027", () => {
    expect(run({ deadline: "built" })).toEqual(["c"]);
    expect(run({ deadline: 2027, rooms: [3] })).toEqual([]);
    expect(run({ deadline: 2028, rooms: [3] })).toEqual(["a"]);
  });

  it("отделка, район и застройщик", () => {
    expect(run({ finishings: ["white-box"] })).toEqual(["a", "b"]);
    expect(run({ developers: ["kamalak"] })).toEqual(["b"]);
    expect(run({ locations: ["margilan"] })).toEqual([]);
  });

  it("сортировки: дешевле, дороже (без цены — в конце), срок сдачи", () => {
    expect(run({ sort: "cheap" })).toEqual(["a", "b", "c"]);
    expect(run({ sort: "exp" })).toEqual(["c", "b", "a"]);
    expect(run({ sort: "dl" })).toEqual(["c", "a", "b"]);
    expect(matchingPriceUsd(catalog.complexes[1]!, catalog, NO_FILTER)).toBe(60000);
  });
});
