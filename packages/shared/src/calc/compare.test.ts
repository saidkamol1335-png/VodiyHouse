import { describe, expect, it } from "vitest";
import type { CalcInput } from "./calculate";
import { comparePrograms, paymentFrom } from "./compare";
import {
  MOCKUP_RATE,
  SIFAT_FULL,
  SIFAT_IPOTEKA_INSTALLMENT,
  SIFAT_IPOTEKA_MORTGAGE,
  SIFAT_SCHEME,
} from "./fixtures";
import { roundMoney } from "./money";
import type { CalcProgram } from "./programs";

// Сравнение программ застройщика и «Платёж от» — правила мокапа (Main.dc.html, vmCalc).

const SIFAT: CalcProgram[] = [
  SIFAT_FULL,
  SIFAT_SCHEME,
  SIFAT_IPOTEKA_INSTALLMENT,
  SIFAT_IPOTEKA_MORTGAGE,
];

const input: CalcInput = {
  price: 84_000,
  priceCurrency: "USD",
  downPct: 20,
  months: 24,
  rate: MOCKUP_RATE,
};

describe("сравнение программ (сайт)", () => {
  const { rows, unavailable } = comparePrograms(SIFAT, input);
  const row = (program: CalcProgram) => rows.find((item) => item.program === program)!;

  it("взнос не ниже минимума программы, срок — тот же или самый длинный (SiteCalc1)", () => {
    expect(unavailable).toEqual([]);
    expect(row(SIFAT_SCHEME).calculation).toMatchObject({ downPct: 30, months: 24 });
    expect(row(SIFAT_IPOTEKA_INSTALLMENT).calculation).toMatchObject({ downPct: 20, months: 24 });
    expect(row(SIFAT_IPOTEKA_MORTGAGE).calculation).toMatchObject({ downPct: 25, months: 180 });
    const scheme = row(SIFAT_SCHEME).calculation;
    expect(roundMoney(scheme.firstPayment * MOCKUP_RATE.usdUzs, "UZS")).toBe(28_931_000);
  });

  it("без скидок 100 % и рассрочка 0 % вровень — «выгоднее всего» у обеих (MobFlatCmp)", () => {
    expect(row(SIFAT_FULL).cheapest).toBe(true);
    expect(row(SIFAT_SCHEME).cheapest).toBe(true);
    expect(row(SIFAT_IPOTEKA_INSTALLMENT).cheapest).toBe(false);
  });

  it("«меньше платёж» — у ипотеки; у 100 % оплаты платежа нет", () => {
    expect(row(SIFAT_IPOTEKA_MORTGAGE).lowestPayment).toBe(true);
    expect(row(SIFAT_FULL).lowestPayment).toBe(false);
  });

  it("нет курса — банковские программы отдельно, застройщика считаются", () => {
    const result = comparePrograms(SIFAT, { ...input, rate: null });
    expect(result.unavailable).toEqual([SIFAT_IPOTEKA_INSTALLMENT, SIFAT_IPOTEKA_MORTGAGE]);
    expect(result.rows.map((item) => item.program)).toEqual([SIFAT_FULL, SIFAT_SCHEME]);
  });
});

describe("«Платёж от» карточки ЖК", () => {
  it("минимум по рассрочке застройщика и через банк: мин. взнос, самый длинный срок", () => {
    // 60 м² × $620: схема 30 % / 36 мес. → $723,33; банк 20 % / 24 мес. → 17 545 000 сум ≈ $1 486.
    expect(paymentFrom(SIFAT, 37_200, "USD", MOCKUP_RATE)).toBeCloseTo((37_200 * 0.7) / 36, 6);
  });

  it("ипотека и 100 % оплата не участвуют; без курса банк пропускается", () => {
    expect(
      paymentFrom([SIFAT_FULL, SIFAT_IPOTEKA_MORTGAGE], 37_200, "USD", MOCKUP_RATE),
    ).toBeNull();
    const bankOnly = paymentFrom([SIFAT_IPOTEKA_INSTALLMENT], 37_200, "USD", MOCKUP_RATE);
    expect(roundMoney(bankOnly!, "USD")).toBe(1486);
    expect(paymentFrom([SIFAT_IPOTEKA_INSTALLMENT], 37_200, "USD", null)).toBeNull();
  });
});

describe("сравнение: схема со сроком другой программы (ревью 2.1)", () => {
  it("«уточним у застройщика» (lead) в сравнении не берёт 180 мес. ипотеки — схема на своём максимуме", () => {
    const lead = { ...SIFAT_SCHEME, overMaxBehavior: "lead" as const };
    const { rows } = comparePrograms([lead, SIFAT_IPOTEKA_MORTGAGE], {
      ...input,
      price: 100_000,
      downPct: 30,
      months: 180,
    });
    const scheme = rows.find((row) => row.program === lead)!;
    expect(scheme.calculation.months).toBe(36);
    expect(scheme.lowestPayment).toBe(false);
  });
});
