import { describe, expect, it } from "vitest";
import type { CalcStock } from "./priceSource";
import type { SiteProgramRecord } from "./records";
import { pricedOptions, siteOptionFrom } from "./siteOptions";

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

// Решение «Валюта»: без курса программы банка в чужой для цен застройщика валюте на сайте скрыты.
describe("программы без курса", () => {
  const RATE = { usdUzs: 11_838.92, date: "2026-10-24", source: "cbu" as const };
  const bank = (id: string, currency: "USD" | "UZS") =>
    siteOptionFrom(
      record({
        id,
        type: "bank_installment",
        method: "annuity",
        bank: { ru: "Bank", uz: "Bank" },
        min_down_pct: 20,
        tiers: [],
        terms: [{ months: 24, rate_pct: 24 }],
        currency,
      }),
    );
  const markup = siteOptionFrom(
    record({
      id: "markup",
      method: "markup",
      min_down_pct: 30,
      tiers: [],
      terms: [{ months: 12, rate_pct: 10 }],
    }),
  );
  const scheme = siteOptionFrom(record({ id: "scheme" }));
  const OPTIONS = [scheme, markup, bank("uzs", "UZS"), bank("usd", "USD")];
  const stock = (currencies: ("USD" | "UZS")[], hint: "USD" | "UZS" | null = null): CalcStock => ({
    blocks: currencies.map((currency, index) => ({
      id: `b${index}`,
      name: "A",
      complexId: "c1",
      complexName: { ru: "ЖК", uz: "TJM" },
      currency,
    })),
    layouts: [],
    units: [],
    priceHint: hint ? { perM2: 700, currency: hint } : null,
  });
  const ids = (result: ReturnType<typeof pricedOptions>) =>
    result.options.map((option) => option.id);

  it("курс есть — все программы, строки «курс недоступен» нет", () => {
    const result = pricedOptions(OPTIONS, stock(["USD"]), RATE);
    expect(ids(result)).toEqual(["scheme", "markup", "uzs", "usd"]);
    expect(result.hiddenForRate).toBe(false);
  });

  it("курса нет, блоки в $ — банк в сумах скрыт; схема, наценка и банк в $ остаются", () => {
    const result = pricedOptions(OPTIONS, stock(["USD"]), null);
    expect(ids(result)).toEqual(["scheme", "markup", "usd"]);
    expect(result.hiddenForRate).toBe(true);
  });

  it("курса нет, есть блок в сумах — банк в сумах считается по его ценам и остаётся", () => {
    expect(ids(pricedOptions(OPTIONS, stock(["USD", "UZS"]), null))).toEqual(
      OPTIONS.map((o) => o.id),
    );
    expect(pricedOptions(OPTIONS, stock(["UZS"]), null).options.map((o) => o.id)).toEqual([
      "scheme",
      "markup",
      "uzs",
    ]);
  });

  it("курса нет, блоков нет — валюта подсказки цены м², без неё — $ (как у «Суммы»)", () => {
    expect(ids(pricedOptions(OPTIONS, stock([], "UZS"), null))).toEqual([
      "scheme",
      "markup",
      "uzs",
    ]);
    expect(ids(pricedOptions(OPTIONS, stock([]), null))).toEqual(["scheme", "markup", "usd"]);
  });

  it("курса нет: валюта — по блокам программы; банк в сумах только на блоке в $ скрыт", () => {
    const onlyUsdBlock = {
      ...bank("uzs-b0", "UZS"),
      blocksScope: "selected" as const,
      blockIds: ["b0"],
    };
    const onlyUzsBlock = {
      ...bank("uzs-b1", "UZS"),
      blocksScope: "selected" as const,
      blockIds: ["b1"],
    };
    const result = pricedOptions([onlyUsdBlock, onlyUzsBlock], stock(["USD", "UZS"]), null);
    expect(ids(result)).toEqual(["uzs-b1"]);
    expect(result.hiddenForRate).toBe(true);
  });

  it("скрывать нечего — строки нет", () => {
    expect(pricedOptions([scheme, markup], stock(["USD"]), null).hiddenForRate).toBe(false);
  });
});
