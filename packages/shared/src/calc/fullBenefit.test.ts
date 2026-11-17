import { describe, expect, it } from "vitest";
import type { CalcInput } from "./calculate";
import { MOCKUP_RATE, SIFAT_SCHEME } from "./fixtures";
import { fullBenefitPct, fullBenefitPricing } from "./fullBenefit";
import { SITE_ENGINE } from "./options";
import type { FullPaymentProgram } from "./programs";
import { programFromRecord, type SiteProgramRecord } from "./records";

// Выгода (скидка) за 100 % на сайте (правки 15.11, п. 21, блок D): процент приходит из базы только при
// включённых «Скидках на сайте»; без него расчёт как раньше.

const input: CalcInput = { price: 84_000, priceCurrency: "USD", downPct: 30, months: 24, rate: MOCKUP_RATE };

/** «100% оплата», как её отдаёт база при выключенных скидках (у фикстуры SIFAT_FULL — скидка кабинета). */
const SIFAT_FULL: FullPaymentProgram = { type: "full" };

describe("скидка за 100 % оплату на сайте", () => {
  const discounted: FullPaymentProgram = { type: "full", benefitPct: 8 };

  it("цена по программе — минус процент, разница видна; без процента — как раньше", () => {
    const with8 = SITE_ENGINE.calculate(discounted, input);
    expect(with8.ok && with8.calculation).toMatchObject({ price: 84_000, programPrice: 77_280, total: 77_280, down: 77_280 });
    const plain = SITE_ENGINE.calculate(SIFAT_FULL, input);
    expect(plain.ok && plain.calculation).toMatchObject({ price: 84_000, programPrice: 84_000, total: 84_000 });
    expect(fullBenefitPricing(SIFAT_SCHEME)).toBeUndefined();
    expect(fullBenefitPct(SIFAT_SCHEME)).toBe(0);
  });

  it("со скидкой «выгоднее всего» — у 100 % оплаты; без скидки — ни у кого (вровень с рассрочкой 0 %)", () => {
    const { rows } = SITE_ENGINE.compare([discounted, SIFAT_SCHEME], input);
    expect(rows.filter((row) => row.cheapest).map((row) => row.program)).toEqual([discounted]);
    const { rows: plain } = SITE_ENGINE.compare([SIFAT_FULL, SIFAT_SCHEME], input);
    expect(plain.some((row) => row.cheapest)).toBe(false);
  });

  it("запись базы: процент читается только у «100% оплаты» и только в пределах 0–50", () => {
    const record = (patch: Partial<SiteProgramRecord>) => ({ type: "full", method: null, tiers: [], terms: [], fees: [], ...patch }) as SiteProgramRecord;
    expect(programFromRecord(record({ benefit_pct: "8.00" }))).toEqual({ type: "full", benefitPct: 8 });
    expect(programFromRecord(record({ benefit_pct: null }))).toEqual({ type: "full" });
    expect(programFromRecord(record({ benefit_pct: 80 }))).toEqual({ type: "full" });
  });
});
