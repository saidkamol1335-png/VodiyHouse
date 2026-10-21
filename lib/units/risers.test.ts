import { describe, expect, it } from "vitest";
import { generateUnits, type BlockPlan } from "./blockPlan";
import {
  applyRisers,
  defaultRisers,
  fitRisersToPlan,
  layoutForSlot,
  riserChanges,
  uncoveredSlots,
  validateRisers,
  type Riser,
} from "./risers";

const PLAN: BlockPlan = {
  entrances: 3,
  floors: 16,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4, 4],
  startNumber: 1,
};

const general = (
  position: number,
  layoutId: string | null,
  floorFrom = 2,
  floorTo = 16,
): Riser => ({
  entrance: null,
  position,
  floorFrom,
  floorTo,
  layoutId,
});

const countBy = <T>(items: readonly T[], key: (item: T) => string | null) => {
  const counts = new Map<string | null, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return Object.fromEntries(counts);
};

describe("стояки", () => {
  it("по умолчанию — стояк на каждую позицию, все подъезды и жилые этажи, без планировки", () => {
    expect(defaultRisers(PLAN)).toEqual([1, 2, 3, 4].map((position) => general(position, null)));
    expect(defaultRisers({ ...PLAN, unitsPerFloor: [4, 6, 2] })).toHaveLength(6);
  });

  it("четыре строки назначают планировки всем 180 квартирам — по 45 на стояк", () => {
    const risers = [general(1, "1k"), general(2, "2k-a"), general(3, "2k-b"), general(4, "3k")];
    const units = applyRisers(generateUnits(PLAN), risers);
    expect(countBy(units, (unit) => unit.layoutId)).toEqual({
      "1k": 45,
      "2k-a": 45,
      "2k-b": 45,
      "3k": 45,
    });
  });

  it("стояк подъезда уточняет общий, диапазон этажей делит стояк", () => {
    const risers = [
      general(1, "1k"),
      { entrance: 3, position: 1, floorFrom: 2, floorTo: 16, layoutId: "1k-wide" },
      general(4, "3k", 2, 15),
      general(4, "penthouse", 16, 16),
    ];
    expect(layoutForSlot({ entrance: 1, floor: 5, position: 1 }, risers)).toBe("1k");
    expect(layoutForSlot({ entrance: 3, floor: 5, position: 1 }, risers)).toBe("1k-wide");
    expect(layoutForSlot({ entrance: 2, floor: 15, position: 4 }, risers)).toBe("3k");
    expect(layoutForSlot({ entrance: 2, floor: 16, position: 4 }, risers)).toBe("penthouse");
    expect(validateRisers(PLAN, risers)).toEqual([]);
  });

  it("без выбранной планировки или вне стояков квартира остаётся без планировки", () => {
    const risers = [general(1, null), general(2, "2k", 2, 10)];
    expect(layoutForSlot({ entrance: 1, floor: 5, position: 1 }, risers)).toBeNull();
    expect(layoutForSlot({ entrance: 1, floor: 11, position: 2 }, risers)).toBeNull();
    expect(layoutForSlot({ entrance: 1, floor: 5, position: 3 }, risers)).toBeNull();
  });

  it("сохранение стояков меняет только расходящиеся планировки и не трогает квартиры вне стояков", () => {
    const units = [
      { id: "a", entrance: 1, floor: 2, position: 1, layoutId: "1k" },
      { id: "b", entrance: 1, floor: 3, position: 1, layoutId: "old" },
      { id: "c", entrance: 1, floor: 2, position: 2, layoutId: "manual" },
    ];
    expect(riserChanges(units, [general(1, "1k")])).toEqual([{ id: "b", layoutId: "1k" }]);
  });
});

describe("стояки · проверка", () => {
  it("общие стояки одной позиции не должны пересекаться по этажам", () => {
    expect(validateRisers(PLAN, [general(1, "a", 2, 10), general(1, "b", 10, 16)])).toEqual([
      { code: "riserOverlap", riser: 2, other: 1 },
    ]);
  });

  it("стояки одного подъезда — тоже", () => {
    const riser = (floorFrom: number, floorTo: number): Riser => ({
      entrance: 2,
      position: 3,
      floorFrom,
      floorTo,
      layoutId: "x",
    });
    expect(validateRisers(PLAN, [riser(2, 8), riser(5, 9)])).toEqual([
      { code: "riserOverlap", riser: 2, other: 1 },
    ]);
  });

  it("позиция — в пределах квартир на этаже подъезда", () => {
    const plan = { ...PLAN, unitsPerFloor: [4, 2, 4] };
    const risers: Riser[] = [
      { entrance: 2, position: 3, floorFrom: 2, floorTo: 16, layoutId: "x" },
      general(5, "y"),
    ];
    expect(validateRisers(plan, risers)).toEqual([
      { code: "riserPositionOutOfRange", riser: 1 },
      { code: "riserPositionOutOfRange", riser: 2 },
    ]);
  });

  it("этажи — только жилые и по порядку; подъезд — существующий", () => {
    const risers: Riser[] = [
      general(1, "a", 1, 16),
      general(2, "b", 10, 5),
      { entrance: 4, position: 1, floorFrom: 2, floorTo: 16, layoutId: "c" },
    ];
    expect(validateRisers(PLAN, risers)).toEqual([
      { code: "riserFloorsOutOfRange", riser: 1 },
      { code: "riserFloorsOutOfRange", riser: 2 },
      { code: "riserEntranceOutOfRange", riser: 3 },
    ]);
  });
});

describe("стояки генератора под изменившийся план", () => {
  it("выбранные планировки остаются, этажи — в пределах, лишние подъезды и позиции отпадают", () => {
    const risers: Riser[] = [
      general(1, "1k"),
      { entrance: 3, position: 1, floorFrom: 2, floorTo: 16, layoutId: "1k-wide" },
      general(4, "3k"),
    ];
    const smaller: BlockPlan = { ...PLAN, entrances: 2, floors: 12, unitsPerFloor: [3, 3] };
    expect(fitRisersToPlan(risers, smaller)).toEqual([
      general(1, "1k", 2, 12),
      general(2, null, 2, 12),
      general(3, null, 2, 12),
    ]);
  });

  it("свой стояк подъезда остаётся, пока подъезд и позиция есть; нижний этаж поднимается", () => {
    const risers: Riser[] = [
      general(1, "1k"),
      { entrance: 2, position: 1, floorFrom: 2, floorTo: 5, layoutId: "1k-wide" },
    ];
    const plan: BlockPlan = { ...PLAN, firstResidentialFloor: 3, unitsPerFloor: [1, 1, 1] };
    expect(fitRisersToPlan(risers, plan)).toEqual([
      general(1, "1k", 3, 16),
      { entrance: 2, position: 1, floorFrom: 3, floorTo: 5, layoutId: "1k-wide" },
    ]);
  });
});

describe("стояки генератора: смена первого жилого этажа", () => {
  const floors = (plan: BlockPlan, first: number): BlockPlan => ({
    ...plan,
    firstResidentialFloor: first,
  });

  it("первый жилой ниже — стояки, начинавшиеся с прежнего, тянутся вниз", () => {
    const plan = { ...PLAN, entrances: 2, unitsPerFloor: [2, 2] };
    const risers = defaultRisers(plan).map((riser) => ({ ...riser, layoutId: "1k" }));
    const fitted = fitRisersToPlan(risers, floors(plan, 1), plan);
    expect(fitted.every((riser) => riser.floorFrom === 1 && riser.floorTo === 16)).toBe(true);
    expect(uncoveredSlots(floors(plan, 1), fitted)).toBe(0);
  });

  it("первый жилой выше раздела — нижняя строка отпадает, без пересечений", () => {
    const plan = { ...PLAN, entrances: 1, unitsPerFloor: [1] };
    const risers: Riser[] = [general(1, "a", 2, 8), general(1, "b", 9, 16)];
    const higher = floors(plan, 10);
    const fitted = fitRisersToPlan(risers, higher, plan);
    expect(fitted).toEqual([general(1, "b", 10, 16)]);
    expect(validateRisers(higher, fitted)).toEqual([]);
  });

  it("без прежнего плана этажи только подтягиваются в пределы", () => {
    const plan = { ...PLAN, entrances: 1, unitsPerFloor: [1] };
    expect(fitRisersToPlan([general(1, "a", 5, 16)], floors(plan, 2))).toEqual([
      general(1, "a", 5, 16),
    ]);
  });
});

describe("места вне стояков", () => {
  it("убранная строка оставляет её этажи без стояка", () => {
    const plan = { ...PLAN, entrances: 2, unitsPerFloor: [2, 2] };
    const risers = defaultRisers(plan);
    expect(uncoveredSlots(plan, risers)).toBe(0);
    const shrunk = risers.map((riser, index) => (index === 0 ? { ...riser, floorTo: 11 } : riser));
    // Позиция 1, эт. 12–16, в двух подъездах.
    expect(uncoveredSlots(plan, shrunk)).toBe(10);
    expect(uncoveredSlots({ ...plan, entrances: 0 }, risers)).toBe(0);
  });
});
