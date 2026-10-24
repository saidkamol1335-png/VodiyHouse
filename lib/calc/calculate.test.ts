import { describe, expect, it } from "vitest";
import { calculateWithDiscount } from "./cabinet/discounts";
import { type CalcInput, type Calculation, calculate } from "./calculate";
import {
  MARGILAN_IPAK_INSTALLMENT,
  MOCKUP_RATE,
  SIFAT_FULL,
  SIFAT_IPOTEKA_INSTALLMENT,
  SIFAT_IPOTEKA_MORTGAGE,
  SIFAT_SCHEME,
} from "./fixtures";
import { annuityPayment, differentiatedPayments } from "./formulas";
import { roundMoney } from "./money";
import type { CalcProgram, TermsProgram } from "./programs";

// Обязательные тесты PLAN §7 «Фаза 2» и числа экранов мокапа (курс 11 808,76 на 01.10.2026).

const usd = (price: number, downPct: number, months: number | null): CalcInput => ({
  price,
  priceCurrency: "USD",
  downPct,
  months,
  rate: MOCKUP_RATE,
});

function ok(result: ReturnType<typeof calculate>): Calculation {
  if (!result.ok) throw new Error(`расчёт не удался: ${result.problem}`);
  return result.calculation;
}

const site = (program: CalcProgram, input: CalcInput) => ok(calculate(program, input));
const cabinet = (program: Parameters<typeof calculateWithDiscount>[0], input: CalcInput) =>
  ok(calculateWithDiscount(program, input));

/** Сумма к выводу — как её покажет экран. */
const shown = (calculation: Calculation, amount: number) =>
  roundMoney(amount, calculation.currency);

describe("схема застройщика (PLAN §7)", () => {
  it("кабинет: $100 000, взнос 50 %, 18 мес. → P $94 000, взнос $47 000, платёж $2 611", () => {
    const result = cabinet(SIFAT_SCHEME, usd(100_000, 50, 18));
    expect(result.programPrice).toBe(94_000);
    expect(result.down).toBe(47_000);
    expect(shown(result, result.firstPayment)).toBe(2611);
    expect(result.total).toBe(94_000);
    expect(result.overpayment).toBe(0);
  });

  it("24 мес. при взносе 50 % (block) → расчёт на 18 мес. и максимум в ответе", () => {
    const result = cabinet(SIFAT_SCHEME, usd(100_000, 50, 24));
    expect(result.months).toBe(18);
    expect(result.term).toMatchObject({ requested: 24, applied: 18, max: 18, status: "aboveMax" });
    expect(shown(result, result.firstPayment)).toBe(2611);
  });

  it("100 % оплата в кабинете → $88 000, платежей нет", () => {
    const result = cabinet(SIFAT_FULL, usd(100_000, 100, null));
    expect(result.total).toBe(88_000);
    expect(result.financed).toBe(0);
    expect(result.months).toBe(0);
  });

  it("свой срок 17 мес.: кабинет $2 765, сайт без скидки — взнос $50 000 и $2 941", () => {
    const cabinetResult = cabinet(SIFAT_SCHEME, usd(100_000, 50, 17));
    expect(cabinetResult).toMatchObject({ programPrice: 94_000, down: 47_000, months: 17 });
    expect(shown(cabinetResult, cabinetResult.firstPayment)).toBe(2765);
    const siteResult = site(SIFAT_SCHEME, usd(100_000, 50, 17));
    expect(siteResult.programPrice).toBe(100_000);
    expect(siteResult.down).toBe(50_000);
    expect(shown(siteResult, siteResult.firstPayment)).toBe(2941);
  });

  it("на сайте 100 % оплата — без скидки", () => {
    expect(site(SIFAT_FULL, usd(100_000, 100, null)).total).toBe(100_000);
  });

  it("взнос ниже минимума поднимается до первой ступени, выше 90 % — до 90 %", () => {
    expect(site(SIFAT_SCHEME, usd(100_000, 10, null)).downPct).toBe(30);
    expect(site(SIFAT_SCHEME, usd(100_000, 99, null)).downPct).toBe(90);
  });
});

describe("рассрочка с наценкой и банки (PLAN §7)", () => {
  const markup: TermsProgram = {
    type: "installment",
    method: "markup",
    minDownPct: 30,
    terms: [{ months: 24, ratePct: 10 }],
    fees: [],
    currency: null,
  };

  it("наценка: $60 000, 30 %, 10 %, 24 мес. → остаток 42 000, наценка 4 200, платёж 1 925, итого 64 200", () => {
    const result = site(markup, usd(60_000, 30, 24));
    expect(result.financed).toBe(42_000);
    expect(result.extra).toBeCloseTo(4200, 6);
    expect(result.firstPayment).toBeCloseTo(1925, 6);
    expect(result.total).toBeCloseTo(64_200, 6);
  });

  it("аннуитет: 100 000 000 сум, 24 %, 12 мес. → M ≈ 9 455 960, переплата ≈ 13 471 516", () => {
    const payment = annuityPayment(100_000_000, 24, 12);
    expect(Math.abs(payment - 9_455_960)).toBeLessThanOrEqual(1);
    expect(Math.abs(payment * 12 - 100_000_000 - 13_471_516)).toBeLessThanOrEqual(1);
  });

  it("ставка 0: 12 000 000 на 12 мес. → 1 000 000", () => {
    expect(annuityPayment(12_000_000, 0, 12)).toBe(1_000_000);
  });

  it("дифференцированный: 120 000 000, 24 %, 12 мес. → 12 400 000 … 10 200 000, проценты 15 600 000", () => {
    const { first, last, interest } = differentiatedPayments(120_000_000, 24, 12);
    expect(first).toBeCloseTo(12_400_000, 4);
    expect(last).toBeCloseTo(10_200_000, 4);
    expect(interest).toBeCloseTo(15_600_000, 4);
  });

  it("нет курса — банк в сумах не считается; нет цены — ничего не считается", () => {
    const noRate = calculate(SIFAT_IPOTEKA_INSTALLMENT, { ...usd(84_000, 20, 24), rate: null });
    expect(noRate).toEqual({ ok: false, problem: "noRate" });
    expect(calculate(SIFAT_SCHEME, usd(0, 50, null))).toEqual({ ok: false, problem: "noPrice" });
  });
});

describe("числа экранов мокапа", () => {
  it("SiteCalc1: 120 м² × $700, Ipoteka Bank 20 % на 24 мес. → 39 617 000 сум, итог 1 158 636 000", () => {
    const result = site(SIFAT_IPOTEKA_INSTALLMENT, usd(120 * 700, 20, 24));
    expect(result.currency).toBe("UZS");
    expect(shown(result, result.price)).toBe(991_936_000);
    expect(shown(result, result.down)).toBe(198_387_000);
    expect(shown(result, result.financed)).toBe(793_549_000);
    expect(shown(result, result.firstPayment)).toBe(39_617_000);
    expect(shown(result, result.extra)).toBe(157_264_000);
    expect(result.fees.map((fee) => [fee.name, shown(result, fee.amount)])).toEqual([
      ["appraisal", 1_500_000],
      ["commission", 7_935_000],
    ]);
    expect(shown(result, result.overpayment)).toBe(166_700_000);
    expect(shown(result, result.total)).toBe(1_158_636_000);
  });

  it("SiteCalc1, сравнение: ипотека 25 % на 15 лет → 11 714 000 сум, итог 2 361 743 000", () => {
    const result = site(SIFAT_IPOTEKA_MORTGAGE, usd(84_000, 25, 180));
    expect(shown(result, result.firstPayment)).toBe(11_714_000);
    expect(shown(result, result.total)).toBe(2_361_743_000);
    expect(shown(result, result.overpayment)).toBe(1_369_807_000);
  });

  it("SiteCalc2: 145 м² × $980, Ipak Yuli дифференцированный 25 % на 36 мес.", () => {
    const result = site(MARGILAN_IPAK_INSTALLMENT, usd(145 * 980, 25, 36));
    expect(shown(result, result.price)).toBe(1_678_025_000);
    expect(shown(result, result.firstPayment)).toBe(52_788_000);
    expect(shown(result, result.lastPayment)).toBe(35_454_000);
    expect(shown(result, result.extra)).toBe(329_837_000);
    expect(shown(result, result.overpayment)).toBe(342_422_000);
    expect(shown(result, result.total)).toBe(2_020_447_000);
  });

  it("квартира $54 930 (SiteJkCalc1) и $47 640 (MobFlatBank) через Ipoteka Bank 20 % на 24 мес.", () => {
    const jk = site(SIFAT_IPOTEKA_INSTALLMENT, usd(54_930, 20, 24));
    expect(shown(jk, jk.firstPayment)).toBe(25_907_000);
    expect(shown(jk, jk.total)).toBe(758_184_000);
    const flat = site(SIFAT_IPOTEKA_INSTALLMENT, usd(47_640, 20, 24));
    expect(shown(flat, flat.firstPayment)).toBe(22_469_000);
    expect(shown(flat, flat.total)).toBe(657_761_000);
  });

  it("MobFlatTerm: сайт, $47 640, взнос 50 %, свой срок 17 → $1 401", () => {
    const result = site(SIFAT_SCHEME, usd(47_640, 50, 17));
    expect(shown(result, result.down)).toBe(23_820);
    expect(shown(result, result.firstPayment)).toBe(1401);
  });

  it("примеры карточек CabProg (60 м² × $620): схема 30 % / 36 → $723, банк 20 % / 24 → 17 545 000 сум", () => {
    const scheme = site(SIFAT_SCHEME, usd(60 * 620, 30, 36));
    expect(shown(scheme, scheme.firstPayment)).toBe(723);
    const bank = site(SIFAT_IPOTEKA_INSTALLMENT, usd(60 * 620, 20, 24));
    expect(shown(bank, bank.firstPayment)).toBe(17_545_000);
    expect(cabinet(SIFAT_FULL, usd(60 * 620, 100, null)).total).toBeCloseTo(32_736, 6);
  });
});

describe("ноль без минуса (ревью 2.1)", () => {
  it("аннуитет под 0 %: переплата ровно 0; около нуля округление не даёт −0", () => {
    const zero: TermsProgram = {
      type: "bank_installment",
      method: "annuity",
      minDownPct: 20,
      terms: [{ months: 13, ratePct: 0 }],
      fees: [],
      currency: null,
    };
    const result = site(zero, {
      price: 77_777_777,
      priceCurrency: "UZS",
      downPct: 20,
      months: 13,
      rate: null,
    });
    expect(result.overpayment).toBe(0);
    expect(Object.is(roundMoney(-1e-9, "UZS"), 0)).toBe(true);
    expect(Object.is(roundMoney(-0.3, "USD"), 0)).toBe(true);
  });
});
