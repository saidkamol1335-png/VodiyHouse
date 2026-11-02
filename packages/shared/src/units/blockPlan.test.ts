import { describe, expect, it } from "vitest";
import {
  BLOCK_PLAN_LIMITS,
  generateUnits,
  summarizeBlockPlan,
  validateBlockPlan,
  type BlockPlan,
} from "./blockPlan";

// Приёмка фазы 1: блок 16 эт. × 3 подъезда × 4 кв. создаётся генератором.
const ACCEPTANCE_PLAN: BlockPlan = {
  entrances: 3,
  floors: 16,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4, 4],
  startNumber: 1,
};

describe("генератор блока · итог", () => {
  it("16 эт. × 3 подъезда × 4 кв., жилые со 2-го: 180 квартир, № 1–180", () => {
    expect(summarizeBlockPlan(ACCEPTANCE_PLAN)).toEqual({
      total: 180,
      residentialFloors: 15,
      firstNumber: 1,
      lastNumber: 180,
      entrances: [
        { entrance: 1, count: 60, firstNumber: 1, lastNumber: 60 },
        { entrance: 2, count: 60, firstNumber: 61, lastNumber: 120 },
        { entrance: 3, count: 60, firstNumber: 121, lastNumber: 180 },
      ],
    });
  });

  it("жилые с 1-го этажа: 192 квартиры", () => {
    expect(summarizeBlockPlan({ ...ACCEPTANCE_PLAN, firstResidentialFloor: 1 })?.total).toBe(192);
  });

  it("разное число квартир в подъездах и свой начальный номер", () => {
    const summary = summarizeBlockPlan({
      entrances: 2,
      floors: 9,
      firstResidentialFloor: 1,
      unitsPerFloor: [4, 6],
      startNumber: 101,
    });
    expect(summary?.entrances).toEqual([
      { entrance: 1, count: 36, firstNumber: 101, lastNumber: 136 },
      { entrance: 2, count: 54, firstNumber: 137, lastNumber: 190 },
    ]);
  });

  it("неверные параметры — итога нет", () => {
    expect(summarizeBlockPlan({ ...ACCEPTANCE_PLAN, entrances: 0 })).toBeNull();
  });
});

describe("генератор блока · квартиры", () => {
  it("сквозная нумерация: подъезд за подъездом, снизу вверх, по позициям", () => {
    const units = generateUnits(ACCEPTANCE_PLAN);
    expect(units).toHaveLength(180);
    expect(units.slice(0, 5)).toEqual([
      { entrance: 1, floor: 2, position: 1, number: "1" },
      { entrance: 1, floor: 2, position: 2, number: "2" },
      { entrance: 1, floor: 2, position: 3, number: "3" },
      { entrance: 1, floor: 2, position: 4, number: "4" },
      { entrance: 1, floor: 3, position: 1, number: "5" },
    ]);
    expect(units[60]).toEqual({ entrance: 2, floor: 2, position: 1, number: "61" });
    expect(units.at(-1)).toEqual({ entrance: 3, floor: 16, position: 4, number: "180" });
  });

  it("места и номера уникальны — как требуют ограничения таблицы units", () => {
    const units = generateUnits(ACCEPTANCE_PLAN);
    const slots = new Set(units.map((unit) => `${unit.entrance}/${unit.floor}/${unit.position}`));
    const numbers = new Set(units.map((unit) => unit.number));
    expect(slots.size).toBe(units.length);
    expect(numbers.size).toBe(units.length);
  });

  it("итог всегда совпадает со списком", () => {
    for (let entrances = 1; entrances <= 4; entrances += 1) {
      for (const firstResidentialFloor of [1, 2, 3]) {
        const plan: BlockPlan = {
          entrances,
          floors: 5 + entrances * 3,
          firstResidentialFloor,
          unitsPerFloor: Array.from({ length: entrances }, (_, index) => 2 + ((index * 3) % 5)),
          startNumber: 1 + entrances * 10,
        };
        const units = generateUnits(plan);
        const summary = summarizeBlockPlan(plan)!;
        expect(units).toHaveLength(summary.total);
        expect(units[0]?.number).toBe(String(summary.firstNumber));
        expect(units.at(-1)?.number).toBe(String(summary.lastNumber));
        for (const entrance of summary.entrances) {
          const own = units.filter((unit) => unit.entrance === entrance.entrance);
          expect(own).toHaveLength(entrance.count);
          expect(own[0]?.number).toBe(String(entrance.firstNumber));
        }
      }
    }
  });

  it("с неверными параметрами не генерирует", () => {
    expect(() => generateUnits({ ...ACCEPTANCE_PLAN, floors: 0 })).toThrow(/floorsOutOfRange/);
  });
});

describe("генератор блока · проверка параметров", () => {
  it("верные параметры — без замечаний", () => {
    expect(validateBlockPlan(ACCEPTANCE_PLAN)).toEqual([]);
  });

  it.each([
    [{ entrances: 0, unitsPerFloor: [] }, "entrancesOutOfRange"],
    [{ entrances: 51, unitsPerFloor: Array(51).fill(1) }, "entrancesOutOfRange"],
    [{ floors: 101 }, "floorsOutOfRange"],
    [{ floors: 2.5 }, "floorsOutOfRange"],
    [{ firstResidentialFloor: 0 }, "firstResidentialFloorOutOfRange"],
    [{ firstResidentialFloor: 17 }, "firstResidentialFloorOutOfRange"],
    [{ unitsPerFloor: [4, 4] }, "unitsPerFloorCountMismatch"],
    [{ startNumber: 0 }, "startNumberOutOfRange"],
  ] as const)("%o → %s", (change, code) => {
    const codes = validateBlockPlan({ ...ACCEPTANCE_PLAN, ...change }).map((issue) => issue.code);
    expect(codes).toContain(code);
  });

  it("называет подъезд с неверным числом квартир", () => {
    expect(validateBlockPlan({ ...ACCEPTANCE_PLAN, unitsPerFloor: [4, 0, 51] })).toEqual([
      { code: "unitsPerFloorOutOfRange", entrance: 2 },
      { code: "unitsPerFloorOutOfRange", entrance: 3 },
    ]);
  });

  it("слишком большой блок — с итогом, чтобы показать число", () => {
    const issues = validateBlockPlan({
      entrances: 10,
      floors: 100,
      firstResidentialFloor: 1,
      unitsPerFloor: Array(10).fill(10),
      startNumber: 1,
    });
    expect(issues).toEqual([{ code: "tooManyUnits", total: 10_000 }]);
    expect(10_000).toBeGreaterThan(BLOCK_PLAN_LIMITS.totalUnits);
  });
});
