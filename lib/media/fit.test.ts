import { describe, expect, it } from "vitest";
import { MAX_CANVAS_AREA, downscaleSteps, fitWithin } from "./fit";

describe("уменьшение до 3200 px", () => {
  it("горизонтальное и вертикальное — по длинной стороне", () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 3200)).toEqual({ width: 3200, height: 2400 });
    expect(fitWithin({ width: 3000, height: 4000 }, 3200)).toEqual({ width: 2400, height: 3200 });
  });

  it("меньше предела — без изменений, маленькое не растягивается", () => {
    expect(fitWithin({ width: 2000, height: 1500 }, 3200)).toEqual({ width: 2000, height: 1500 });
  });

  it("округляет до целых пикселей и не даёт нулевой стороны", () => {
    expect(fitWithin({ width: 6001, height: 4001 }, 3200)).toEqual({ width: 3200, height: 2134 });
    expect(fitWithin({ width: 10_000, height: 1 }, 12)).toEqual({ width: 12, height: 1 });
  });
});

describe("шаги уменьшения", () => {
  const ratiosOf = (source: { width: number }, steps: { width: number }[]) =>
    steps.map((step, index) => (index === 0 ? source.width : steps[index - 1]!.width) / step.width);

  it("чуть больше цели — один шаг", () => {
    const target = { width: 3200, height: 2400 };
    expect(downscaleSteps({ width: 4000, height: 3000 }, target)).toEqual([target]);
  });

  it("blur-заглушка из 3200 px: не больше чем вдвое за шаг, последний — цель", () => {
    const source = { width: 3200, height: 2400 };
    const target = { width: 12, height: 9 };
    const steps = downscaleSteps(source, target);
    expect(steps.at(-1)).toEqual(target);
    expect(steps[0]).toEqual({ width: 3072, height: 2304 });
    expect(ratiosOf(source, steps).every((ratio) => ratio <= 2)).toBe(true);
  });

  it("промежуточный холст больше 16,7 Мп (предел iOS) пропускается", () => {
    const source = { width: 9000, height: 6000 };
    const target = { width: 3200, height: 2133 };
    expect(downscaleSteps(source, target)).toEqual([target]);
    expect(downscaleSteps(source, target, MAX_CANVAS_AREA * 2)).toEqual([
      { width: 6400, height: 4266 },
      target,
    ]);
  });
});
