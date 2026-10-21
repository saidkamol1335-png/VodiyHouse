import { describe, expect, it } from "vitest";
import { defaultRisers, summarizeBlockPlan, validateBlockPlan } from "@/lib/units";
import {
  generatorDefaults,
  generatorIssues,
  generatorPlan,
  samePlanShape,
  unassignedCount,
} from "./generator";

describe("генератор: поля формы → план", () => {
  it("по умолчанию — 2 подъезда × 4 квартиры со 2-го этажа: у 16 этажей 120 квартир", () => {
    const plan = generatorPlan(generatorDefaults(16), 16);
    expect(plan).toEqual({
      entrances: 2,
      floors: 16,
      firstResidentialFloor: 2,
      unitsPerFloor: [4, 4],
      startNumber: 1,
    });
    expect(summarizeBlockPlan(plan)?.total).toBe(120);
    expect(generatorDefaults(1).firstFloor).toBe("1");
  });

  it("«в подъездах по-разному» — своё число у подъезда, пустое — общее", () => {
    const inputs = {
      ...generatorDefaults(16),
      entrances: "3",
      perEntrance: true,
      perEntranceValues: ["4", "6"],
    };
    expect(generatorPlan(inputs, 16).unitsPerFloor).toEqual([4, 6, 4]);
    // Один подъезд — общее поле, даже если «по-разному» осталось отмеченным.
    expect(generatorPlan({ ...inputs, entrances: "1" }, 16).unitsPerFloor).toEqual([4]);
  });

  it("пусто и не число — NaN, проверка плана назовёт поле; «подъездов нет» не дублируется", () => {
    const plan = generatorPlan({ ...generatorDefaults(16), entrances: "", startNumber: "1а" }, 16);
    expect(plan.unitsPerFloor).toEqual([]);
    expect(generatorIssues(validateBlockPlan(plan)).map((issue) => issue.code)).toEqual([
      "entrancesOutOfRange",
      "startNumberOutOfRange",
    ]);
  });

  it("без планировок в стояках — все квартиры без типа; с планировкой — меньше", () => {
    const plan = generatorPlan(generatorDefaults(5), 5);
    const risers = defaultRisers(plan);
    expect(unassignedCount(plan, risers)).toBe(32);
    expect(
      unassignedCount(
        plan,
        risers.map((riser, index) => (index === 0 ? { ...riser, layoutId: "l1" } : riser)),
      ),
    ).toBe(24);
  });

  it("форма плана: номер квартиры стояки не меняет, первый жилой — меняет", () => {
    const plan = generatorPlan(generatorDefaults(16), 16);
    expect(samePlanShape(plan, { ...plan, startNumber: 101 })).toBe(true);
    expect(samePlanShape(plan, { ...plan, firstResidentialFloor: 3 })).toBe(false);
    expect(samePlanShape(plan, { ...plan, unitsPerFloor: [4, 5] })).toBe(false);
  });
});
