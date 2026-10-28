import { describe, expect, it } from "vitest";
import { NO_FILTER } from "@/lib/site/catalog/filter";
import type { CatalogBlock, CatalogComplex, CatalogOffer, SiteCatalog } from "@/lib/site/catalog/records";
import { deadlineOf, EMPTY_ANSWERS, quizFilter, quizMatches, toggleRoom } from "./model";

const offer = (rooms: number, priceFrom: number | null, free: number | null = 3, available = true): CatalogOffer => ({
  rooms,
  available,
  free,
  areaFrom: 50,
  priceFrom,
  priceTo: priceFrom,
  pricePerM2From: null,
});

const block = (id: string, patch: Partial<CatalogBlock>): CatalogBlock => ({
  id,
  name: id,
  currency: "USD",
  buildStatus: "building",
  deadline: { year: 2027, quarter: 2 },
  floorsTotal: 12,
  finishing: null,
  offers: [],
  ...patch,
});

const complex = (slug: string, blocks: CatalogBlock[]): CatalogComplex => ({
  id: slug,
  slug,
  name: { ru: slug, uz: slug },
  class: "comfort",
  sort: 0,
  developerId: "d1",
  location: null,
  address: null,
  landmark: null,
  minutesToCenter: null,
  checked: { permit: null, land: null, visit: null },
  createdAt: "2026-10-01",
  photos: [],
  blocks,
});

// A — 2-комн. $40 000 (сдача 2027) и 3-комн. $90 000 (2028); B — сдан, 2-комн. $55 000, наличие без числа;
// C — 1-комн. $30 000, рассрочка только на него.
const catalog: SiteCatalog = {
  rate: null,
  developers: [
    {
      id: "d1",
      slug: "sifat",
      name: "Sifat",
      programs: [
        { id: "p1", program: { type: "full" }, bank: null, blocksScope: "all", blockIds: [] },
        {
          id: "p2",
          program: { type: "installment", method: "tiers", tiers: [{ minDownPct: 30, minMonths: 1, maxMonths: 36 }], presetMonths: [12, 24, 36], allowCustomMonths: true, overMaxBehavior: "block" },
          bank: null,
          blocksScope: "selected",
          blockIds: ["c1"],
        },
      ],
    },
  ],
  complexes: [
    complex("a", [block("a1", { offers: [offer(2, 40_000, 5)] }), block("a2", { deadline: { year: 2028, quarter: 1 }, offers: [offer(3, 90_000, 2)] })]),
    complex("b", [block("b1", { buildStatus: "delivered", deadline: null, offers: [offer(2, 55_000, null)] })]),
    complex("c", [block("c1", { offers: [offer(1, 30_000, 4)] })]),
  ],
};

const NOW = new Date("2026-10-28T12:00:00Z");

describe("квиз → фильтр каталога", () => {
  it("без ответов — пустой фильтр", () => {
    expect(quizFilter(EMPTY_ANSWERS, NOW)).toEqual(NO_FILTER);
  });

  it("комнаты, бюджет и оплата — как чипы каталога; «не важно» и «пока не знаю» ничего не добавляют", () => {
    expect(quizFilter({ rooms: [3, 1], budget: 45_000, payment: "inst", when: "any" }, NOW)).toEqual({
      ...NO_FILTER,
      rooms: [1, 3],
      priceMax: 45_000,
      payments: ["inst"],
    });
    expect(quizFilter({ rooms: [], budget: 0, payment: "unsure", when: null }, NOW)).toEqual(NO_FILTER);
  });

  it("срок въезда: сразу — сданные, в течение года — до 2027, через 1–2 года — до 2028", () => {
    expect(deadlineOf("now", NOW)).toBe("built");
    expect(deadlineOf("year", NOW)).toBe(2027);
    expect(deadlineOf("later", NOW)).toBe(2028);
    expect(deadlineOf("any", NOW)).toBe("any");
  });

  it("комнаты можно выбирать несколько, повторное нажатие снимает, порядок — по возрастанию", () => {
    expect(toggleRoom([2], 1)).toEqual([1, 2]);
    expect(toggleRoom([1, 2], 2)).toEqual([1]);
  });
});

describe("живой счётчик", () => {
  it("считает ЖК и свободные квартиры подходящих типов; без числа у типа — «не меньше»; дешевле первыми", () => {
    const match = quizMatches(catalog, quizFilter({ rooms: [2], budget: 60_000, payment: null, when: "any" }, NOW));
    expect(match.complexes.map((item) => item.slug)).toEqual(["a", "b"]);
    expect(match.flats).toBe(5);
    expect(match.partial).toBe(true);
    expect(match.prices.get("a")).toBe(40_000);
  });

  it("квартиры считаются только в подходящих блоках: «в течение года» отсекает блок 2028 вместе с его квартирами", () => {
    const year = quizMatches(catalog, quizFilter({ rooms: [], budget: 0, payment: null, when: "year" }, NOW));
    expect(year.complexes.map((item) => item.slug)).toEqual(["c", "a", "b"]);
    expect(year.flats).toBe(4 + 5);
    const now = quizMatches(catalog, quizFilter({ rooms: [], budget: 0, payment: null, when: "now" }, NOW));
    expect(now.complexes.map((item) => item.slug)).toEqual(["b"]);
    expect(now.flats).toBe(0);
    expect(now.partial).toBe(true);
  });

  it("рассрочка — только у блока с программой; ничего не подошло — пустой список", () => {
    const installment = quizMatches(catalog, quizFilter({ rooms: [], budget: 0, payment: "inst", when: null }, NOW));
    expect(installment.complexes.map((item) => item.slug)).toEqual(["c"]);
    const none = quizMatches(catalog, quizFilter({ rooms: [4], budget: null, payment: null, when: null }, NOW));
    expect(none.complexes).toEqual([]);
    expect(none.flats).toBe(0);
  });
});
