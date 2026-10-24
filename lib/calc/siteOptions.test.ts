import { describe, expect, it } from "vitest";
import type { SiteProgramRecord } from "./records";
import { siteOptionFrom } from "./siteOptions";

// Программа сайта → калькулятор: вид, банк, блоки, «актуальны на»; полей скидки нет вовсе.

const record = (patch: Partial<SiteProgramRecord>): SiteProgramRecord => ({
  id: "p1",
  type: "installment",
  method: "tiers",
  bank: null,
  min_down_pct: null,
  tiers: [{ min_down_pct: 30, min_months: 1, max_months: 36 }],
  terms: [],
  fees: [],
  preset_months: [12, 24, 36, 48],
  allow_custom_months: true,
  over_max_behavior: "block",
  currency: null,
  blocks_scope: "all",
  block_ids: [],
  updated_at: "2026-10-01T09:00:00+00:00",
  ...patch,
});

describe("программа сайта → калькулятор", () => {
  it("схема застройщика: вид scheme, ступени без скидки", () => {
    const option = siteOptionFrom(record({}));
    expect(option).toMatchObject({ id: "p1", kind: "scheme", bankName: null, blocksScope: "all" });
    expect(option.program).toEqual({
      type: "installment",
      method: "tiers",
      tiers: [{ minDownPct: 30, minMonths: 1, maxMonths: 36 }],
      presetMonths: [12, 24, 36, 48],
      allowCustomMonths: true,
      overMaxBehavior: "block",
    });
    expect(JSON.stringify(option)).not.toMatch(/discount/i);
  });

  it("ипотека банка: вид mortgage, название банка на двух языках, блоки", () => {
    const option = siteOptionFrom(
      record({
        type: "mortgage",
        method: "annuity",
        bank: { ru: "Ipoteka Bank", uz: "Ipoteka Bank" },
        min_down_pct: 25,
        tiers: [],
        terms: [{ months: 180, rate_pct: 17.5 }],
        currency: "UZS",
        blocks_scope: "selected",
        block_ids: ["b1"],
      }),
    );
    expect(option).toMatchObject({
      kind: "mortgage",
      bankName: { ru: "Ipoteka Bank", uz: "Ipoteka Bank" },
      blocksScope: "selected",
      blockIds: ["b1"],
    });
  });
});
