import { describe, expect, it } from "vitest";
import {
  BUILD_STAGES,
  elevationAt,
  FRAME_COUNT,
  frameOfProgress,
  padIndex,
  span,
  STAGE_COUNT,
  stageOfFrame,
} from "./stages";

describe("этапы первого экрана", () => {
  it("доля ролика 0…1 — кадры с первого по последний, за границами — крайние", () => {
    expect(frameOfProgress(0)).toBe(0);
    expect(frameOfProgress(1)).toBe(FRAME_COUNT - 1);
    expect(frameOfProgress(-0.5)).toBe(0);
    expect(frameOfProgress(2)).toBe(FRAME_COUNT - 1);
    expect(frameOfProgress(Number.NaN)).toBe(0);
  });

  it("span — доля отрезка: 0 до него, 1 после, половина посередине", () => {
    expect(span(0.03, 0.06, 0.92)).toBe(0);
    expect(span(0.49, 0.06, 0.92)).toBeCloseTo(0.5);
    expect(span(0.95, 0.06, 0.92)).toBe(1);
  });

  it("восемь этапов начинаются с первого кадра и идут по порядку внутри ролика", () => {
    expect(BUILD_STAGES).toHaveLength(STAGE_COUNT);
    expect(BUILD_STAGES[0]!.from).toBe(0);
    for (let index = 1; index < STAGE_COUNT; index++) {
      expect(BUILD_STAGES[index]!.from).toBeGreaterThan(BUILD_STAGES[index - 1]!.from);
    }
    expect(BUILD_STAGES[STAGE_COUNT - 1]!.from).toBeLessThan(FRAME_COUNT);
  });

  it("кадр → этап: граница этапа принадлежит новому этапу, последний кадр — «Дом сдан»", () => {
    expect(stageOfFrame(0)).toBe(0);
    expect(stageOfFrame(BUILD_STAGES[1]!.from - 1)).toBe(0);
    expect(stageOfFrame(BUILD_STAGES[1]!.from)).toBe(1);
    expect(stageOfFrame(BUILD_STAGES[1]!.from + 0.5)).toBe(1);
    expect(stageOfFrame(FRAME_COUNT - 1)).toBe(STAGE_COUNT - 1);
  });

  it("отметка высоты: ноль со знаком ±, минус в котловане, плюс на каркасе, в конце — кровля", () => {
    expect(elevationAt(0)).toBe("±0,000");
    expect(elevationAt(BUILD_STAGES[1]!.from)).toBe("−6,500");
    expect(elevationAt(BUILD_STAGES[3]!.from)).toBe("+28,400");
    expect(elevationAt(FRAME_COUNT - 1)).toBe("+54,600");
    // между этапами — промежуточное значение
    const middle = (BUILD_STAGES[1]!.from + BUILD_STAGES[2]!.from) / 2;
    expect(elevationAt(middle)).toBe("−4,850");
  });

  it("номера с нулём впереди", () => {
    expect(padIndex(1)).toBe("01");
    expect(padIndex(12)).toBe("12");
  });
});
