import { describe, expect, it } from "vitest";
import { defaultRisers, type BlockPlan } from "@/lib/units";
import { unitsDbFailure } from "./errors";
import {
  blockNameConfirmed,
  readPlan,
  readPrice,
  readRisers,
  readRisersForPlan,
  readRisersSnapshot,
  readUnitIds,
  readUnitPatch,
} from "./parse";

const ID = "8f0e9a5e-6c2b-4b5e-9a51-0d1d6f1f2a3b";
const PLAN: BlockPlan = {
  entrances: 2,
  floors: 12,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4],
  startNumber: 1,
};

describe("вход действий «Квартир»", () => {
  it("выбранные квартиры — uuid без повторов, не больше 5000", () => {
    expect(readUnitIds([ID, ID.toUpperCase()])).toEqual([ID]);
    expect(readUnitIds(["1"])).toBeNull();
    expect(readUnitIds("x")).toBeNull();
    expect(readUnitIds(Array.from({ length: 5001 }, () => crypto.randomUUID()))).toBeNull();
  });

  it("цена (Н3): целое > 0 в пределах режима; «без цены» — без суммы", () => {
    expect(readPrice("per_m2", 620)).toEqual({ mode: "per_m2", value: 620 });
    expect(readPrice("total", 999_999_999_999)).toEqual({ mode: "total", value: 999_999_999_999 });
    expect(readPrice("none", null)).toEqual({ mode: "none", value: null });
    for (const [mode, value] of [
      ["total", 0],
      ["total", 620.5],
      ["per_m2", 1_000_000_000],
      ["none", 5],
      ["rub", 5],
      ["total", "620"],
    ]) {
      expect(readPrice(mode, value), `${mode} ${value}`).toBeNull();
    }
  });

  it("правка строки → патч функции базы: только переданные поля, номер нормализован", () => {
    expect(readUnitPatch({ number: " 12a " })).toEqual({ number: "12A" });
    expect(readUnitPatch({ layoutId: null, finishingId: 2 })).toEqual({
      layout_id: null,
      finishing_id: 2,
    });
    expect(readUnitPatch({ price: { mode: "total", value: 41000 } })).toEqual({
      price: { mode: "total", value: 41000 },
    });
    for (const bad of [
      {},
      { status: "sold" },
      { number: "12 Б" },
      { layoutId: "x" },
      { finishingId: 0 },
      null,
    ]) {
      expect(readUnitPatch(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("план генератора — целые и правила validateBlockPlan; стояки — в границах плана", () => {
    expect(readPlan(PLAN)).toEqual(PLAN);
    expect(readPlan({ ...PLAN, unitsPerFloor: [4] })).toBeNull();
    expect(readPlan({ ...PLAN, floors: "12" })).toBeNull();
    const risers = defaultRisers(PLAN).map((riser) => ({ ...riser, layoutId: ID }));
    expect(readRisers(risers, PLAN)).toEqual(risers);
    expect(readRisers([{ ...risers[0], floorTo: 13 }], PLAN)).toBeNull();
    expect(readRisers([{ ...risers[0], layoutId: "x" }], PLAN)).toBeNull();
    expect(readRisers([risers[0], risers[0]], PLAN)).toBeNull();
    // Снимок base — только форма: план мог сжаться после него (CR1 приёмки 12.7).
    expect(readRisersSnapshot([{ ...risers[0], floorFrom: 1, floorTo: 13 }])).toHaveLength(1);
    expect(readRisersSnapshot([{ ...risers[0], layoutId: "x" }])).toBeNull();
    expect(readRisersSnapshot("x")).toBeNull();
  });

  it("черновик стояков готового блока — под сжавшийся план, а не отказ (второй круг 12.7)", () => {
    const risers = defaultRisers(PLAN).map((riser) => ({ ...riser, layoutId: ID }));
    // Удалили эт. 2 и позицию 4: нетронутые строки черновика — со старыми границами.
    const shrunk: BlockPlan = { ...PLAN, firstResidentialFloor: 3, unitsPerFloor: [3, 3] };
    expect(readRisers(risers, shrunk)).toBeNull();
    const clipped = readRisersForPlan(risers, shrunk)!;
    expect(clipped.map((riser) => [riser.position, riser.floorFrom, riser.floorTo])).toEqual([
      [1, 3, 12],
      [2, 3, 12],
      [3, 3, 12],
    ]);
    // Пустой этаж не прячется обрезкой — это ошибка черновика.
    expect(readRisersForPlan([{ ...risers[0], floorFrom: Number.NaN }], shrunk)).toBeNull();
  });

  it("«Удалить список блока»: название — без регистра и с двойниками A ↔ А", () => {
    expect(blockNameConfirmed("a", "A")).toBe(true);
    expect(blockNameConfirmed(" А ", "A")).toBe(true);
    expect(blockNameConfirmed("Б", "B")).toBe(false);
    expect(blockNameConfirmed("", "A")).toBe(false);
  });
});

describe("отказ базы → ответ формы", () => {
  it("поле из detail vh:invalid, недостающее — из vh:not_ready, номер и место различаются", () => {
    expect(unitsDbFailure({ code: "22023", hint: "vh:invalid", details: "price" })).toEqual({
      status: "error",
      error: "invalid",
      field: "price",
      broken: [],
    });
    expect(unitsDbFailure({ code: "22023", hint: "vh:invalid", details: "3" }).field).toBeNull();
    expect(
      unitsDbFailure({ code: "23514", hint: "vh:not_ready", details: "layouts" }).broken,
    ).toEqual(["layouts"]);
    expect(unitsDbFailure({ code: "23505", hint: "vh:unit_taken", details: "slot" }).error).toBe(
      "unitSlotTaken",
    );
  });
});
