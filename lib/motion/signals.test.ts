import { describe, expect, it } from "vitest";
import { decideFromSignals, type MotionSignals } from "./signals";

const strongDesktop: MotionSignals = {
  reducedMotion: false,
  deviceMemory: 8,
  hardwareConcurrency: 8,
  saveData: false,
  effectiveType: "4g",
  coarsePointer: false,
  finePointer: true,
  viewportWidth: 1440,
};

describe("decideFromSignals", () => {
  it("мощный десктоп с мышью — кандидат в full", () => {
    expect(decideFromSignals(strongDesktop)).toBe("candidate");
  });

  it("prefers-reduced-motion — none поверх всего", () => {
    expect(decideFromSignals({ ...strongDesktop, reducedMotion: true })).toBe("none");
  });

  it.each<[string, Partial<MotionSignals>]>([
    ["памяти меньше 4 ГБ", { deviceMemory: 2 }],
    ["4 ядра и меньше", { hardwareConcurrency: 4 }],
    ["экономия трафика", { saveData: true }],
    ["3g", { effectiveType: "3g" }],
    ["slow-2g", { effectiveType: "slow-2g" }],
    ["телефон: палец и ширина < 768", { coarsePointer: true, finePointer: false, viewportWidth: 390 }],
    ["планшет 768–1023", { viewportWidth: 900 }],
    ["широкий экран без мыши", { finePointer: false }],
  ])("lite: %s", (_, override) => {
    expect(decideFromSignals({ ...strongDesktop, ...override })).toBe("lite");
  });

  it("недоступный сигнал не учитывается (Safari: нет deviceMemory и connection)", () => {
    const safari = { ...strongDesktop, deviceMemory: undefined, effectiveType: undefined, saveData: undefined };
    expect(decideFromSignals(safari)).toBe("candidate");
  });

  it("ровно 4 ГБ памяти — не повод для lite", () => {
    expect(decideFromSignals({ ...strongDesktop, deviceMemory: 4 })).toBe("candidate");
  });
});
