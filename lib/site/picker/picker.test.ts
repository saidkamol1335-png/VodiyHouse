import { describe, expect, it } from "vitest";
import {
  bestEntrance,
  bestFloor,
  blockFloors,
  boxOf,
  floorEntrances,
  placeUnits,
  planFor,
  polygonPoints,
  shortUsd,
} from "./model";
import { pickerFrom, unitFrom, type FloorPlan, type PickerRecord, type PickerUnit } from "./records";

const photo = { path: "complexes/x/y.png", width: 1600, height: 1200, blur: null, focus_x: 0.5, focus_y: 0.5, alt: null };
const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

const plan = (overrides: Partial<FloorPlan> = {}): FloorPlan => ({
  id: "p1",
  blockId: "A",
  entrance: 1,
  floorFrom: 2,
  floorTo: 4,
  image: { path: photo.path, width: 1600, height: 1200, blur: null, alt: null, focus: { x: 0.5, y: 0.5 } },
  contours: [
    { entrance: 1, position: 1, points: rect(0, 0, 50, 100) },
    { entrance: 1, position: 2, points: rect(50, 0, 100, 100) },
  ],
  ...overrides,
});

let next = 0;
const unit = (entrance: number, floor: number, position: number, status: PickerUnit["status"]): PickerUnit => ({
  id: `u${(next += 1)}`,
  entrance,
  floor,
  position,
  number: String(next),
  layoutId: "l1",
  rooms: 2,
  area: 54.3,
  status,
  price: status === "free" ? 43600 : null,
  currency: "USD",
});

describe("выбор квартиры на фасаде: данные", () => {
  it("раздел — только с фасадом и блоком, у которого есть и контур, и план", () => {
    const record: PickerRecord = {
      complex_id: "c",
      facade: photo,
      blocks: [
        { id: "A", contour: rect(10, 10, 40, 90) },
        { id: "B", contour: rect(50, 10, 90, 90) },
      ],
      plans: [{ id: "p1", block_id: "A", entrance: 1, floor_from: 2, floor_to: 4, image: photo, contours: [] }],
    };
    expect(pickerFrom(record)?.blocks.map((block) => block.id)).toEqual(["A"]);
    expect(pickerFrom({ ...record, facade: null })).toBeNull();
    expect(pickerFrom({ ...record, plans: [] })).toBeNull();
    expect(pickerFrom(null)).toBeNull();
  });

  it("строка block_units: числа из строк, цена — только у свободной", () => {
    const parsed = unitFrom({
      unit_id: "u",
      entrance: 1,
      floor: 3,
      position: 2,
      number: "41",
      layout_id: null,
      rooms: 1,
      area: "42.50",
      status: "sold",
      price: null,
      currency: "USD",
    });
    expect(parsed).toMatchObject({ area: 42.5, price: null, status: "sold", number: "41" });
  });

  it("этажи сверху вниз со свободными; по умолчанию — где свободных больше, при равенстве выше", () => {
    const units = [unit(1, 2, 1, "free"), unit(1, 2, 2, "free"), unit(1, 3, 1, "free"), unit(1, 3, 2, "free"), unit(1, 4, 1, "sold")];
    const floors = blockFloors([plan()], "A", units);
    expect(floors).toEqual([
      { floor: 4, free: 0, total: 1 },
      { floor: 3, free: 2, total: 2 },
      { floor: 2, free: 2, total: 2 },
    ]);
    expect(bestFloor(floors)).toBe(3);
    expect(bestFloor([])).toBeNull();
  });

  it("подъезды этажа и план: свой подъезд или план всего этажа", () => {
    const plans = [plan(), plan({ id: "p2", entrance: 2, contours: [] })];
    const units = [unit(1, 2, 1, "sold"), unit(2, 2, 1, "free")];
    const entrances = floorEntrances(plans, "A", 2, units);
    expect(entrances).toEqual([
      { entrance: 1, free: 0, total: 1 },
      { entrance: 2, free: 1, total: 1 },
    ]);
    expect(bestEntrance(entrances)).toBe(2);
    expect(planFor(plans, "A", 2, 2)?.id).toBe("p2");
    expect(planFor(plans, "A", 5, 1)).toBeNull();
    expect(planFor([plan({ entrance: null })], "A", 3, 7)?.id).toBe("p1");
  });

  it("квартира на месте контура: подъезд, этаж и позиция; пустое место — null", () => {
    const units = [unit(1, 3, 1, "free"), unit(1, 2, 2, "reserved")];
    const placed = placeUnits(plan(), 3, units);
    expect(placed.map((item) => item.unit?.status ?? null)).toEqual(["free", null]);
  });

  it("геометрия и короткая цена", () => {
    expect(polygonPoints(rect(0, 0, 10, 20))).toBe("0,0 10,0 10,20 0,20");
    expect(boxOf(rect(10, 20, 30, 60))).toEqual({ x0: 10, x1: 30, y0: 20, y1: 60, cx: 20, cy: 40 });
    expect(shortUsd(43600, "ru")).toBe("$43,6k");
    expect(shortUsd(32000, "ru")).toBe("$32k");
    expect(shortUsd(950, "ru")).toBe("$950");
  });
});
