import { describe, expect, it } from "vitest";
import { programFromRecord, rateFromRecord, type SiteProgramRecord } from "./records";

// Записи site_payment_programs → программы lib/calc (числа numeric могут прийти строкой).

const record = (patch: Partial<SiteProgramRecord>): SiteProgramRecord => ({
  id: "p1",
  type: "installment",
  method: "tiers",
  bank: null,
  min_down_pct: null,
  tiers: [],
  terms: [],
  fees: [],
  preset_months: [],
  allow_custom_months: false,
  over_max_behavior: "block",
  currency: null,
  blocks_scope: "all",
  block_ids: [],
  updated_at: "2026-10-24T10:00:00Z",
  ...patch,
});

describe("записи программ сайта", () => {
  it("100 % оплата — без полей", () => {
    expect(programFromRecord(record({ type: "full", method: null }))).toEqual({ type: "full" });
  });

  it("схема застройщика: ступени, кнопки, свой срок, превышение", () => {
    const program = programFromRecord(
      record({
        tiers: [{ min_down_pct: 30, min_months: 1, max_months: 36 }],
        preset_months: [12, 24],
        allow_custom_months: true,
        over_max_behavior: "suggest_tier",
      }),
    );
    expect(program).toEqual({
      type: "installment",
      method: "tiers",
      tiers: [{ minDownPct: 30, minMonths: 1, maxMonths: 36 }],
      presetMonths: [12, 24],
      allowCustomMonths: true,
      overMaxBehavior: "suggest_tier",
    });
  });

  it("банк: строки и разовые, numeric строкой приводится к числу", () => {
    const program = programFromRecord(
      record({
        type: "mortgage",
        method: "annuity",
        min_down_pct: "25" as unknown as number,
        terms: [{ months: 180, rate_pct: "17.5" as unknown as number }],
        fees: [{ name: "appraisal", kind: "fixed", value: 1_500_000 }],
        currency: "UZS",
      }),
    );
    expect(program).toEqual({
      type: "mortgage",
      method: "annuity",
      minDownPct: 25,
      terms: [{ months: 180, ratePct: 17.5 }],
      fees: [{ name: "appraisal", kind: "fixed", value: 1_500_000 }],
      currency: "UZS",
    });
  });

  it("программа без метода — чужая запись, ошибка; курс null — null", () => {
    expect(() => programFromRecord(record({ type: "mortgage", method: null }))).toThrow("p1");
    expect(rateFromRecord(null)).toBeNull();
    expect(rateFromRecord({ usd_uzs: 11808.76, date: "2026-10-01", source: "manual" })).toEqual({
      usdUzs: 11808.76,
      date: "2026-10-01",
      source: "manual",
    });
  });
});
