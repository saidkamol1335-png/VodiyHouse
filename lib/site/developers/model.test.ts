import { describe, expect, it } from "vitest";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { developerChecks, developerComplexes, developerCounts, developerCover, searchDevelopers } from "./model";
import type { DeveloperPage, DeveloperSummary } from "./records";

// Страница застройщика (шаг 3.15): вкладки «Все · Сдано · Строится» по ТЗ 8.6, «Проверено Vodiy
// House» по ТЗ 8.4, фон первого экрана и поиск по названию без апострофов бренда.

type Checked = CatalogComplex["checked"];

const complex = (
  id: string,
  statuses: ("building" | "delivered")[],
  checked: Partial<Checked> = {},
  developerId = "dev-1",
): CatalogComplex =>
  ({
    id,
    slug: id,
    developerId,
    photos: [{ path: `${id}.jpg`, width: 10, height: 10, blur: null, focus: { x: 0.5, y: 0.5 }, alt: null }],
    blocks: statuses.map((buildStatus, index) => ({ id: `${id}-${index}`, buildStatus })),
    checked: { permit: null, land: null, visit: null, ...checked },
  }) as unknown as CatalogComplex;

const developer: DeveloperSummary = {
  id: "dev-1",
  slug: "demo-sifat",
  name: "Farg‘ona Sifat Qurilish",
  foundedYear: 2012,
  deliveredCheckedAt: "2026-09-14",
  logo: null,
};

describe("вкладки объектов (ТЗ 8.6)", () => {
  it("«Сдано» — все блоки сданы; без блоков или со стройкой — «Строится»; всё = сдано + строится", () => {
    const complexes = [complex("a", ["delivered", "delivered"]), complex("b", ["delivered", "building"]), complex("c", [])];
    expect(developerCounts(complexes)).toEqual({ all: 3, built: 1, building: 2 });
  });

  it("ЖК застройщика — только его, в порядке каталога", () => {
    const catalog = { complexes: [complex("x", [], {}, "dev-2"), complex("a", []), complex("b", [])] } as unknown as SiteCatalog;
    expect(developerComplexes(catalog, "dev-1").map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("«Проверено Vodiy House» (ТЗ 8.4)", () => {
  it("хоть один ЖК прошёл всё и сданные объекты проверены — плашка целиком, даты — последние по ЖК", () => {
    const complexes = [
      complex("a", [], { permit: "2026-09-12", land: "2026-09-12", visit: "2026-09-20" }),
      complex("b", [], { permit: "2026-10-01", land: null, visit: null }),
    ];
    expect(developerChecks(developer, complexes)).toEqual({
      verified: true,
      checks: [
        { key: "permit", date: "2026-10-01" },
        { key: "land", date: "2026-09-12" },
        { key: "delivered", date: "2026-09-14" },
        { key: "visit", date: "2026-09-20" },
      ],
    });
  });

  it("ни один ЖК не прошёл всё — без заголовка, только пройденные пункты", () => {
    const complexes = [complex("a", [], { permit: "2026-09-12" })];
    expect(developerChecks({ ...developer, deliveredCheckedAt: null }, complexes)).toEqual({
      verified: false,
      checks: [{ key: "permit", date: "2026-09-12" }],
    });
  });
});

describe("фон и поиск", () => {
  it("фон — свой, иначе обложка первого ЖК с фото, иначе ничего", () => {
    const page = { ...developer, cover: null } as DeveloperPage;
    const own = { path: "cover.jpg", width: 1, height: 1, blur: null, focus: { x: 0.5, y: 0.5 }, alt: null };
    expect(developerCover({ ...page, cover: own }, [complex("a", [])])?.path).toBe("cover.jpg");
    expect(developerCover(page, [complex("a", [])])?.path).toBe("a.jpg");
    expect(developerCover(page, [])).toBeNull();
  });

  it("поиск: без регистра и апострофов, пустой запрос — все", () => {
    const rows = [{ name: "Farg‘ona Sifat Qurilish" }, { name: "Marg‘ilon Invest" }];
    expect(searchDevelopers(rows, "sifat").map((row) => row.name)).toEqual(["Farg‘ona Sifat Qurilish"]);
    expect(searchDevelopers(rows, "farg'ona")).toHaveLength(1);
    expect(searchDevelopers(rows, "  ")).toHaveLength(2);
    expect(searchDevelopers(rows, "zzz")).toEqual([]);
  });
});
