import { describe, expect, it } from "vitest";
import { SIFAT_IPOTEKA_MORTGAGE, SIFAT_SCHEME } from "./fixtures";
import type { DownDiscountProgram } from "./programs";
import {
  allowsCustomMonths,
  resolveSchemeMonths,
  resolveTermRow,
  termButtons,
  tierIndexFor,
} from "./terms";

// Правила сроков PLAN §3б и решения фазы 2: кнопки, свой срок, превышение, строки банков.

const scheme = (patch: Partial<DownDiscountProgram>): DownDiscountProgram => ({
  ...SIFAT_SCHEME,
  ...patch,
});

describe("ступень и кнопки схемы", () => {
  it("ступень — последняя с порогом не выше взноса", () => {
    expect(tierIndexFor(SIFAT_SCHEME.tiers, 30)).toBe(0);
    expect(tierIndexFor(SIFAT_SCHEME.tiers, 49)).toBe(0);
    expect(tierIndexFor(SIFAT_SCHEME.tiers, 50)).toBe(1);
    expect(tierIndexFor(SIFAT_SCHEME.tiers, 90)).toBe(2);
  });

  it("кнопки — 12/24/36/48 в пределах ступени: при 50 % только 12 (PLAN §7), при 30 % — 12, 24, 36", () => {
    expect(termButtons(SIFAT_SCHEME, 50)).toEqual([12]);
    expect(termButtons(SIFAT_SCHEME, 30)).toEqual([12, 24, 36]);
  });

  it("минимальный срок ступени отсекает короткие кнопки", () => {
    const longOnly = scheme({ tiers: [{ minDownPct: 30, minMonths: 24, maxMonths: 48 }] });
    expect(termButtons(longOnly, 30)).toEqual([24, 36, 48]);
  });

  it("у банков кнопки — строки, своего срока нет", () => {
    expect(termButtons(SIFAT_IPOTEKA_MORTGAGE, 25)).toEqual([60, 120, 180]);
    expect(allowsCustomMonths(SIFAT_IPOTEKA_MORTGAGE)).toBe(false);
    expect(allowsCustomMonths(SIFAT_SCHEME)).toBe(true);
    expect(termButtons({ type: "full" }, 100)).toEqual([]);
  });
});

describe("срок схемы", () => {
  it("по умолчанию — максимум ступени, без своего срока — самая длинная кнопка", () => {
    expect(resolveSchemeMonths(SIFAT_SCHEME, 50, null)).toMatchObject({
      applied: 18,
      status: "ok",
    });
    const fixed = scheme({ allowCustomMonths: false });
    expect(resolveSchemeMonths(fixed, 50, null).applied).toBe(12);
    expect(resolveSchemeMonths(fixed, 50, 17)).toMatchObject({ applied: 12, status: "notOffered" });
  });

  it("свой срок в пределах ступени — как просили; ниже минимума — минимум", () => {
    expect(resolveSchemeMonths(SIFAT_SCHEME, 50, 17)).toMatchObject({ applied: 17, status: "ok" });
    const fromSix = scheme({ tiers: [{ minDownPct: 30, minMonths: 6, maxMonths: 36 }] });
    expect(resolveSchemeMonths(fromSix, 30, 3)).toMatchObject({ applied: 6, status: "belowMin" });
  });

  it("сверх максимума: block — на максимуме, без подсказки", () => {
    expect(resolveSchemeMonths(SIFAT_SCHEME, 50, 24)).toMatchObject({
      applied: 18,
      max: 18,
      status: "aboveMax",
      behavior: "block",
      suggestion: null,
    });
  });

  it("suggest_tier — на максимуме и «24 мес. — при взносе 30–49 %» (PLAN §7)", () => {
    const outcome = resolveSchemeMonths(scheme({ overMaxBehavior: "suggest_tier" }), 50, 24);
    expect(outcome).toMatchObject({ applied: 18, status: "aboveMax" });
    expect(outcome.suggestion).toEqual({ months: 24, fromDownPct: 30, toDownPct: 49 });
  });

  it("suggest_tier при 70 % и 24 мес. — ближайшая ступень с таким сроком (30 %)", () => {
    const outcome = resolveSchemeMonths(scheme({ overMaxBehavior: "suggest_tier" }), 70, 24);
    expect(outcome.suggestion).toEqual({ months: 24, fromDownPct: 30, toDownPct: 49 });
    const shorter = resolveSchemeMonths(scheme({ overMaxBehavior: "suggest_tier" }), 70, 18);
    expect(shorter.suggestion).toEqual({ months: 18, fromDownPct: 50, toDownPct: 69 });
  });

  it("suggest_tier без подходящей ступени — как block", () => {
    const outcome = resolveSchemeMonths(scheme({ overMaxBehavior: "suggest_tier" }), 50, 60);
    expect(outcome).toMatchObject({ applied: 18, status: "aboveMax", suggestion: null });
  });

  it("lead — расчёт на просимый срок, отметка превышения остаётся", () => {
    const outcome = resolveSchemeMonths(scheme({ overMaxBehavior: "lead" }), 50, 24);
    expect(outcome).toMatchObject({ applied: 24, max: 18, status: "aboveMax", behavior: "lead" });
  });
});

describe("строки сроков банков", () => {
  it("есть строка — она; нет — самая длинная с пометкой; без просьбы — самая длинная", () => {
    expect(resolveTermRow(SIFAT_IPOTEKA_MORTGAGE, 120)?.term).toMatchObject({
      applied: 120,
      status: "ok",
    });
    expect(resolveTermRow(SIFAT_IPOTEKA_MORTGAGE, 24)?.term).toMatchObject({
      applied: 180,
      status: "notOffered",
    });
    expect(resolveTermRow(SIFAT_IPOTEKA_MORTGAGE, null)?.term).toMatchObject({
      applied: 180,
      min: 60,
      max: 180,
      status: "ok",
    });
  });

  it("без строк — посчитать нечего", () => {
    expect(resolveTermRow({ ...SIFAT_IPOTEKA_MORTGAGE, terms: [] }, null)).toBeNull();
  });
});
