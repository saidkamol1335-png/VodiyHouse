import { describe, expect, it } from "vitest";
import { NO_FILTER } from "./filter";
import type { CatalogBlock, CatalogComplex, SiteCatalog } from "./records";
import { collectionResults } from "@/lib/site/showcase/model";
import type { ShowcaseCollection } from "@/lib/site/showcase/records";
import { filterCatalog, withoutSoon } from "./sort";

// ЖК «Скоро» в каталоге (docs/publication-rule.md): в конце выдачи, фильтры цены и комнат его не показывают.

const block = (id: string, offers: CatalogBlock["offers"]): CatalogBlock => ({
  id,
  name: id,
  currency: "USD",
  buildStatus: "building",
  deadline: { year: 2027, quarter: 4 },
  floorsTotal: 12,
  finishing: null,
  offers,
});

const complex = (id: string, state: "soon" | "full", price: number | null): CatalogComplex =>
  ({
    id,
    slug: id,
    name: { ru: id, uz: id },
    class: null,
    sort: 0,
    state,
    developerId: "d",
    location: null,
    address: null,
    landmark: null,
    minutesToCenter: null,
    checked: { permit: null, land: null, visit: null },
    createdAt: "2026-11-01",
    photos: [],
    blocks: [
      block(
        `${id}-a`,
        price === null
          ? []
          : [{ rooms: 2, available: true, free: 3, areaFrom: 60, priceFrom: price, priceTo: price, pricePerM2From: price / 60 }],
      ),
    ],
  }) as CatalogComplex;

const catalog: SiteCatalog = {
  rate: null,
  developers: [{ id: "d", slug: "dev", name: "Dev", programs: [] }],
  complexes: [complex("soon", "soon", null), complex("full-a", "full", 50000), complex("full-b", "full", 40000)],
};
const ids = (list: readonly CatalogComplex[]) => list.map((item) => item.id);

describe("ЖК «Скоро» в каталоге", () => {
  it("без фильтра — есть, в конце списка", () => {
    expect(ids(filterCatalog(catalog, NO_FILTER))).toEqual(["full-a", "full-b", "soon"]);
  });

  it("в конце при любой сортировке", () => {
    expect(ids(filterCatalog(catalog, { ...NO_FILTER, sort: "cheap" }))).toEqual(["full-b", "full-a", "soon"]);
    expect(ids(filterCatalog(catalog, { ...NO_FILTER, sort: "dl" })).at(-1)).toBe("soon");
  });

  it("фильтры цены и комнат её не показывают", () => {
    expect(ids(filterCatalog(catalog, { ...NO_FILTER, priceMax: 100000 }))).not.toContain("soon");
    expect(ids(filterCatalog(catalog, { ...NO_FILTER, priceMin: 1000 }))).not.toContain("soon");
    expect(ids(filterCatalog(catalog, { ...NO_FILTER, rooms: [2] }))).not.toContain("soon");
  });

  it("срок сдачи к ней применяется", () => {
    expect(ids(filterCatalog(catalog, { ...NO_FILTER, deadline: 2027 }))).toContain("soon");
    expect(ids(filterCatalog(catalog, { ...NO_FILTER, deadline: "built" }))).not.toContain("soon");
  });

  it("подборка по фильтру её не показывает, ручная — показывает", () => {
    const byFilter = { mode: "filter", complexIds: [], filter: NO_FILTER } as unknown as ShowcaseCollection;
    const manual = { mode: "manual", complexIds: ["soon"], filter: NO_FILTER } as unknown as ShowcaseCollection;
    expect(ids(collectionResults(catalog, byFilter, NO_FILTER))).toEqual(["full-a", "full-b"]);
    expect(ids(collectionResults(catalog, manual, NO_FILTER))).toEqual(["soon"]);
  });

  it("для главной и подборок по фильтру её можно убрать", () => {
    expect(ids(withoutSoon(catalog.complexes))).toEqual(["full-a", "full-b"]);
  });
});
