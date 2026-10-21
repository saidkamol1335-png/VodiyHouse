import { describe, expect, it } from "vitest";
import {
  EMPTY_UNIT_FILTER,
  countUnitStatuses,
  filterUnits,
  sortUnitsByNumber,
  unitFilterOptions,
} from "./list";
import type { UnitRecord } from "./record";
import type { UnitStatus } from "./status";

const unit = (
  number: string,
  entrance: number,
  floor: number,
  status: UnitStatus,
  layoutId: string | null,
): UnitRecord => ({
  id: `id-${number}`,
  entrance,
  floor,
  position: 1,
  number,
  layoutId,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status,
  updatedAt: "2026-10-21T10:00:00Z",
  updatedByName: null,
});

const UNITS = [
  unit("1", 1, 2, "free", "studio"),
  unit("2", 1, 3, "reserved", "one"),
  unit("3", 2, 2, "sold", "two"),
  unit("12А", 2, 5, "free", "four"),
  unit("10", 2, 4, "free", null),
];
const ROOMS = new Map([
  ["studio", 0],
  ["one", 1],
  ["two", 2],
  ["four", 5],
]);
const numbers = (units: readonly UnitRecord[]) => units.map((u) => u.number);

describe("список квартир · фильтры", () => {
  it("без фильтров — все", () => {
    expect(filterUnits(UNITS, EMPTY_UNIT_FILTER, ROOMS)).toHaveLength(5);
  });

  it("статус, подъезд, комнаты, этаж «от — до» и номер складываются", () => {
    const filter = { ...EMPTY_UNIT_FILTER, status: "free" as const, entrances: [2] };
    expect(numbers(filterUnits(UNITS, filter, ROOMS))).toEqual(["12А", "10"]);
    expect(numbers(filterUnits(UNITS, { ...filter, rooms: ["4plus"] }, ROOMS))).toEqual(["12А"]);
    expect(numbers(filterUnits(UNITS, { ...filter, rooms: ["none"] }, ROOMS))).toEqual(["10"]);
    expect(
      numbers(filterUnits(UNITS, { ...EMPTY_UNIT_FILTER, floorFrom: 3, floorTo: 4 }, ROOMS)),
    ).toEqual(["2", "10"]);
    expect(numbers(filterUnits(UNITS, { ...EMPTY_UNIT_FILTER, query: "12a" }, ROOMS))).toEqual([
      "12А",
    ]);
  });

  it("счётчики пилюль статуса — по остальным фильтрам, без самого статуса", () => {
    const filter = { ...EMPTY_UNIT_FILTER, status: "sold" as const, entrances: [2] };
    expect(countUnitStatuses(UNITS, filter, ROOMS)).toEqual({
      all: 3,
      free: 2,
      reserved: 0,
      sold: 1,
    });
  });

  it("чипы — только то, что есть в блоке; комнаты по порядку, «без планировки» — последним", () => {
    expect(unitFilterOptions(UNITS, ROOMS)).toEqual({
      entrances: [1, 2],
      rooms: ["studio", "1", "2", "4plus", "none"],
      floors: { min: 2, max: 5 },
    });
    expect(unitFilterOptions([], ROOMS)).toEqual({ entrances: [], rooms: [], floors: null });
  });

  it("порядок номеров: 1, 2, 3, 10, 12А", () => {
    expect(numbers(sortUnitsByNumber(UNITS))).toEqual(["1", "2", "3", "10", "12А"]);
  });
});
