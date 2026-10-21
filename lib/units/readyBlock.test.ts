import { describe, expect, it } from "vitest";
import { generateUnits, type BlockPlan } from "./blockPlan";
import { planFromUnits, risersFromUnits } from "./readyBlock";
import { applyRisers, riserChanges, riserEdits, validateRisers, type Riser } from "./risers";

// Блок Namuna из DEMO-сида: 2 подъезда × эт. 2–16 × 4, позиции 2–3 — свои планировки в
// каждом подъезде, позиция 4 — другая планировка на двух верхних этажах.
const PLAN: BlockPlan = {
  entrances: 2,
  floors: 16,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4],
  startNumber: 1,
};
const NAMUNA: Riser[] = [
  { entrance: null, position: 1, floorFrom: 2, floorTo: 16, layoutId: "st" },
  { entrance: 1, position: 2, floorFrom: 2, floorTo: 16, layoutId: "1a" },
  { entrance: 2, position: 2, floorFrom: 2, floorTo: 16, layoutId: "1b" },
  { entrance: 1, position: 3, floorFrom: 2, floorTo: 16, layoutId: "2a" },
  { entrance: 2, position: 3, floorFrom: 2, floorTo: 16, layoutId: "2b" },
  { entrance: null, position: 4, floorFrom: 2, floorTo: 14, layoutId: "3k" },
  { entrance: null, position: 4, floorFrom: 15, floorTo: 16, layoutId: "4k" },
];

const units = applyRisers(generateUnits(PLAN), NAMUNA).map((unit, index) => ({
  ...unit,
  id: `u${index}`,
}));

describe("готовый блок: стояки из квартир", () => {
  it("собирает те же стояки, что их назначили, — общие и подъездов", () => {
    expect(risersFromUnits(units)).toEqual(NAMUNA);
  });

  it("сохранить собранные стояки без правок — ничего не меняет у квартир", () => {
    expect(riserChanges(units, risersFromUnits(units))).toEqual([]);
  });

  it("ручная правка одной квартиры — отдельный стояк подъезда на её этаж", () => {
    const edited = units.map((unit) =>
      unit.entrance === 2 && unit.floor === 7 && unit.position === 1
        ? { ...unit, layoutId: "st-wide" }
        : unit,
    );
    const risers = risersFromUnits(edited);
    expect(risers.filter((riser) => riser.position === 1)).toEqual([
      { entrance: null, position: 1, floorFrom: 2, floorTo: 6, layoutId: "st" },
      { entrance: null, position: 1, floorFrom: 8, floorTo: 16, layoutId: "st" },
      { entrance: 1, position: 1, floorFrom: 7, floorTo: 7, layoutId: "st" },
      { entrance: 2, position: 1, floorFrom: 7, floorTo: 7, layoutId: "st-wide" },
    ]);
    expect(riserChanges(edited, risers)).toEqual([]);
    expect(validateRisers(planFromUnits(edited, 16), risers)).toEqual([]);
  });

  it("квартиры без планировки — стояк без неё; позиция не во всех подъездах — стояк подъезда", () => {
    const plan = { ...PLAN, floors: 3, unitsPerFloor: [2, 1] };
    const placed = applyRisers(generateUnits(plan), []);
    expect(risersFromUnits(placed)).toEqual([
      { entrance: null, position: 1, floorFrom: 2, floorTo: 3, layoutId: null },
      { entrance: 1, position: 2, floorFrom: 2, floorTo: 3, layoutId: null },
    ]);
  });

  it("стояк без планировки снимает её у попавших квартир, остальных не трогает", () => {
    const changes = riserChanges(units, [
      { entrance: 2, position: 2, floorFrom: 10, floorTo: 11, layoutId: null },
    ]);
    expect(changes).toEqual(
      units
        .filter(
          (unit) =>
            unit.entrance === 2 && unit.position === 2 && unit.floor >= 10 && unit.floor <= 11,
        )
        .map((unit) => ({ id: unit.id, layoutId: null })),
    );
    expect(changes).toHaveLength(2);
  });

  it("границы для проверки стояков — по квартирам и этажности блока", () => {
    expect(planFromUnits(units, 16)).toEqual({ ...PLAN, startNumber: 1 });
    expect(planFromUnits(units, null).floors).toBe(16);
    expect(planFromUnits([], null)).toMatchObject({
      entrances: 1,
      floors: 1,
      firstResidentialFloor: 1,
    });
  });
});

describe("готовый блок: сохранение стояков по снимку", () => {
  // Квартиру поправили вручную уже после того, как панель «Стояки» открыли.
  const edited = units.map((unit) =>
    unit.entrance === 1 && unit.floor === 11 && unit.position === 1
      ? { ...unit, layoutId: "st-wide" }
      : unit,
  );
  const editedId = edited.find((unit) => unit.layoutId === "st-wide")!.id;

  it("поменяли другую позицию — чужая правка не откатывается", () => {
    const next = NAMUNA.map((riser) =>
      riser.position === 4 ? { ...riser, layoutId: "4k" } : riser,
    );
    const { changes, skipped } = riserEdits(edited, NAMUNA, next);
    expect(changes.map((change) => change.id)).not.toContain(editedId);
    expect(changes).toHaveLength(26);
    expect(skipped).toEqual([]);
    // Без снимка тот же набор стояков откатил бы правку.
    expect(riserChanges(edited, next).map((change) => change.id)).toContain(editedId);
  });

  it("поменяли её же позицию — квартира не трогается, она в skipped", () => {
    const next = NAMUNA.map((riser) =>
      riser.position === 1 ? { ...riser, layoutId: "st-new" } : riser,
    );
    const { changes, skipped } = riserEdits(edited, NAMUNA, next);
    expect(skipped.map((unit) => unit.id)).toEqual([editedId]);
    expect(changes).toHaveLength(29);
  });

  it("без правок — ничего; новый стояк вне снимка меняет текущие планировки", () => {
    expect(riserEdits(edited, NAMUNA, NAMUNA)).toEqual({ changes: [], skipped: [] });
    const { changes } = riserEdits(
      edited,
      [],
      [{ entrance: 2, position: 1, floorFrom: 2, floorTo: 3, layoutId: null }],
    );
    expect(changes).toHaveLength(2);
  });
});

describe("готовый блок: 5000 квартир", () => {
  it("предел блока собирается в стояки и границы плана без переполнения стека", () => {
    const big: BlockPlan = {
      entrances: 10,
      floors: 12,
      firstResidentialFloor: 3,
      unitsPerFloor: Array.from({ length: 10 }, () => 50),
      startNumber: 1,
    };
    const placed = generateUnits(big).map((slot) => ({
      ...slot,
      layoutId: `l${slot.position % 4}`,
    }));
    expect(placed).toHaveLength(5000);
    expect(planFromUnits(placed, 12)).toEqual(big);
    const risers = risersFromUnits(placed);
    expect(risers).toHaveLength(50);
    expect(risers.every((riser) => riser.entrance === null && riser.floorFrom === 3)).toBe(true);
    expect(validateRisers(big, risers)).toEqual([]);
  });
});
