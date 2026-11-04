import { describe, expect, it } from "vitest";
import { clamp, damp } from "./damp";

describe("damp", () => {
  it("за одну постоянную времени проходит ~63 % пути", () => {
    expect(damp(0, 100, 300, 50)).toBeCloseTo(100 * (1 - Math.exp(-50 / 300)), 6);
  });

  it("одинаково на 60 и 120 Гц", () => {
    let at60 = 0;
    let at120 = 0;
    for (let i = 0; i < 6; i += 1) at60 = damp(at60, 1, 200, 1000 / 60);
    for (let i = 0; i < 12; i += 1) at120 = damp(at120, 1, 200, 1000 / 120);
    expect(at60).toBeCloseTo(at120, 6);
  });

  it("длинный кадр после паузы ограничен 50 мс, нулевая постоянная — сразу цель", () => {
    expect(damp(0, 1, 100, 5000)).toBeCloseTo(damp(0, 1, 100, 50), 9);
    expect(damp(3, 7, 0, 16)).toBe(7);
  });

  it("clamp", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
