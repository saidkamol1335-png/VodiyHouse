import { describe, expect, it } from "vitest";
import { DEMO_COMPLEX_ROWS } from "../complexes/demo";
import { demoSiteStock, demoSiteStockRead, siteStockScenario } from "./demo";
import {
  siteStockFrom,
  siteStockTotal,
  type BlockAvailabilityRecord,
  type RoomOfferRecord,
  type SiteComplex,
  type SiteStock,
  type SiteStockResult,
} from "./siteStock";

/** Ответ DEMO-чтения — цифры (сценарий без отказа). */
function demoStock(result: SiteStockResult): SiteStock {
  if (result.status !== "done") throw new Error(result.error);
  return result.stock;
}

// «Остатки по ЖК» на главной (шаг 13): одно правило «свободно» со списком «ЖК», «от» по типам
// (в каждой валюте), свободные по блокам и без планировки.

const complex: SiteComplex = {
  id: "c",
  name: { ru: "Shodlik", uz: "Shodlik" },
  locationName: "Фергана",
  developerName: "Farg‘ona Sifat Qurilish",
};

const room = (
  rooms: number,
  free: number | null,
  area: number | string | null,
  price: number | string | null,
  currency = "USD",
  available = free === null || free > 0,
): RoomOfferRecord => ({
  complex_id: "c",
  rooms,
  currency,
  free_count: free,
  listed_free: free ?? 0,
  available,
  area_from: area,
  price_from: price,
});

const block = (
  name: string,
  free: number | null,
  available = true,
  unassigned = 0,
): BlockAvailabilityRecord => ({
  complex_id: "c",
  block_id: `b-${name}`,
  name,
  free_count: free,
  free_unassigned: unassigned,
  available,
});

describe("остатки на главной", () => {
  it("типы — группы строки списка: «4+» складывает 4 и 5 комнат, «от» — минимум доступных", () => {
    const [shodlik] = siteStockFrom(
      [complex],
      [room(1, 6, "42.50", "30290.00"), room(4, 2, 120, 150000), room(5, 1, 160, 140000)],
      [block("A", 9)],
    ).complexes;
    expect(shodlik!.stock).toMatchObject({ free: 9, partial: false });
    expect(shodlik!.offers).toEqual([
      {
        group: "1",
        free: 6,
        known: 6,
        areaFrom: 42.5,
        prices: [{ currency: "USD", amount: 30290 }],
      },
      {
        group: "4plus",
        free: 3,
        known: 3,
        areaFrom: 120,
        prices: [{ currency: "USD", amount: 140000 }],
      },
    ]);
    expect(shodlik!.blocks).toEqual([{ id: "b-A", name: "A", free: 9, available: true }]);
    expect(shodlik!.unassigned).toBe(0);
  });

  it("две валюты — две цены «от»; без цены — пусто («цена по запросу»); распроданный тип — не в типах", () => {
    const [mixed] = siteStockFrom(
      [complex],
      [
        room(2, 4, 64, 37200),
        room(2, null, 60, 450_000_000, "UZS"),
        room(3, 2, 88, null),
        room(1, 0, 40, 30000, "USD", false),
      ],
      [block("A", 6), block("B", null)],
    ).complexes;
    expect(mixed!.offers).toEqual([
      {
        group: "2",
        free: null,
        known: 4,
        areaFrom: 60,
        prices: [
          { currency: "USD", amount: 37200 },
          { currency: "UZS", amount: 450_000_000 },
        ],
      },
      { group: "3", free: 2, known: 2, areaFrom: 88, prices: [] },
    ]);
    // Известные 4 двухкомнатные из блока A не пропадают из «свободно N+».
    expect(mixed!.stock).toMatchObject({ free: 6, partial: true });
  });

  it("свободные без планировки — из блоков (тем же запросом), а не вычитанием из типов", () => {
    const [shodlik] = siteStockFrom(
      [complex],
      [room(1, 3, 42.5, 30000), room(2, null, 60, 40000)],
      [block("A", 5, true, 2), block("B", null, false)],
    ).complexes;
    expect(shodlik!.stock).toMatchObject({ free: 3, partial: true });
    expect(shodlik!.unassigned).toBe(2);
  });

  it("ЖК без записей — «нет свободных», порядок ЖК — как пришёл (каталог)", () => {
    const other = { ...complex, id: "d", name: { ru: "Orzu", uz: "Orzu" } };
    const stock = siteStockFrom([other, complex], [room(1, 3, 42.5, 30000)], []);
    expect(stock.complexes.map((item) => [item.name, item.stock.free])).toEqual([
      ["Orzu", 0],
      ["Shodlik", 3],
    ]);
    expect(siteStockTotal(stock)).toEqual({ free: 3, partial: false, unassigned: 0 });
  });
});

describe("DEMO главной — как сид и как список «ЖК»", () => {
  it("на сайте четыре ЖК, 176 свободных; Shodlik по блокам — «A 12 · B 29»", () => {
    const stock = demoSiteStock(null);
    expect(stock.complexes.map((item) => [item.name, item.stock.free])).toEqual([
      ["Shodlik", 41],
      ["Namuna", 65],
      ["Yulduz", 43],
      ["Orzu", 27],
    ]);
    expect(siteStockTotal(stock)).toEqual({ free: 176, partial: false, unassigned: 0 });
    expect(stock.complexes[0]!.blocks.map((item) => [item.name, item.free])).toEqual([
      ["A", 12],
      ["B", 29],
    ]);
    for (const item of stock.complexes) {
      const listed = DEMO_COMPLEX_ROWS.find((row) => row.id === item.id)!;
      expect(item.stock, item.name).toEqual(listed.stock);
      expect(item.unassigned, item.name).toBe(0);
    }
  });

  it("сценарии: change меняет два ЖК, fail отказывает, empty пуст, variety и layouts — редкие случаи", () => {
    expect(siteStockScenario("change")).toBe("change");
    expect(siteStockScenario("drop table")).toBeNull();
    const changed = demoStock(demoSiteStockRead("change")).complexes.map((item) => item.stock.free);
    expect(changed).toEqual([40, 65, 43, 28]);
    expect(demoSiteStockRead("fail")).toEqual({ status: "error", error: "unavailable" });
    expect(demoSiteStockRead("session")).toEqual({ status: "error", error: "session" });
    expect(demoSiteStock("empty").complexes).toEqual([]);
    const variety = demoSiteStock("variety");
    expect(
      variety.complexes.map((item) => [item.stock.free, item.stock.partial, item.unassigned]),
    ).toEqual([
      [41, false, 2],
      [65, true, 0],
      [0, false, 12],
      [8, false, 0],
    ]);
    expect(siteStockTotal(variety)).toEqual({ free: 114, partial: true, unassigned: 14 });
    expect(siteStockTotal(demoSiteStock("layouts"))).toEqual({
      free: 0,
      partial: true,
      unassigned: 0,
    });
    expect(siteStockTotal(demoSiteStock("unassigned"))).toEqual({
      free: 0,
      partial: false,
      unassigned: 176,
    });
  });
});
