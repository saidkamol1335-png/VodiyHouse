import { describe, expect, it } from "vitest";
import { calculateWithDiscount } from "./cabinet/discounts";
import { type CalcInput, type Calculation, calculate } from "./calculate";
import { MARGILAN_IPAK_INSTALLMENT, SIFAT_FULL, SIFAT_SCHEME } from "./fixtures";
import type { TermsProgram } from "./programs";
import { paymentSchedule, roundedSchedule } from "./schedule";

// График (PLAN §7): строки без округления; к выводу последний платёж забирает разницу.

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function ok(result: ReturnType<typeof calculate>): Calculation {
  if (!result.ok) throw new Error(result.problem);
  return result.calculation;
}

const uzs = (price: number, months: number): CalcInput => ({
  price,
  priceCurrency: "UZS",
  downPct: 0,
  months,
  rate: null,
});

const bank = (method: TermsProgram["method"], ratePct: number, months: number): TermsProgram => ({
  type: "bank_installment",
  method,
  minDownPct: 0,
  terms: [{ months, ratePct }],
  fees: [],
  currency: null,
});

describe("график платежей", () => {
  it("схема: 18 равных платежей, к выводу 17 × $2 611 + $2 613 = $47 000", () => {
    const calculation = ok(
      calculateWithDiscount(SIFAT_SCHEME, {
        price: 100_000,
        priceCurrency: "USD",
        downPct: 50,
        months: 18,
        rate: null,
      }),
    );
    const rows = roundedSchedule(paymentSchedule(calculation), "USD");
    expect(rows).toHaveLength(18);
    expect(rows.slice(0, -1).every((row) => row.payment === 2611)).toBe(true);
    expect(rows.at(-1)?.payment).toBe(2613);
    expect(sum(rows.map((row) => row.payment))).toBe(47_000);
    expect(rows.at(-1)?.balance).toBeCloseTo(0, 6);
  });

  it("аннуитет в сумах: платежи кратны 1000, сумма — округлённый итог, остаток в конце 0", () => {
    const calculation = ok(calculate(bank("annuity", 24, 12), uzs(100_000_000, 12)));
    const exact = paymentSchedule(calculation);
    expect(exact.at(-1)?.balance).toBeCloseTo(0, 2);
    expect(sum(exact.map((row) => row.interest))).toBeCloseTo(calculation.extra, 2);
    const rows = roundedSchedule(exact, "UZS");
    expect(rows.every((row) => row.payment % 1000 === 0)).toBe(true);
    expect(sum(rows.map((row) => row.payment))).toBe(113_472_000);
  });

  it("дифференцированный: первый 12 400 000, последний 10 200 000, проценты 15 600 000", () => {
    const calculation = ok(calculate(bank("differentiated", 24, 12), uzs(120_000_000, 12)));
    const rows = paymentSchedule(calculation);
    expect(rows[0]?.payment).toBeCloseTo(12_400_000, 4);
    expect(rows.at(-1)?.payment).toBeCloseTo(10_200_000, 4);
    expect(sum(rows.map((row) => row.interest))).toBeCloseTo(15_600_000, 4);
  });

  it("наценка делится поровну: $60 000, 30 %, 10 %, 24 мес. → 24 × $1 925, из них $175 наценки", () => {
    const markup = { ...bank("markup", 10, 24), type: "installment" as const };
    const calculation = ok(
      calculate(markup, {
        price: 60_000,
        priceCurrency: "USD",
        downPct: 30,
        months: 24,
        rate: null,
      }),
    );
    const rows = paymentSchedule(calculation);
    expect(rows).toHaveLength(24);
    expect(rows[0]?.payment).toBeCloseTo(1925, 6);
    expect(rows[0]?.interest).toBeCloseTo(175, 6);
  });

  it("сумы кредита Ipak Yuli: последний платёж графика равен последнему платежу расчёта", () => {
    const calculation = ok(
      calculate(MARGILAN_IPAK_INSTALLMENT, {
        price: 142_100,
        priceCurrency: "USD",
        downPct: 25,
        months: 36,
        rate: { usdUzs: 11808.76, date: "2026-10-01", source: "cbu" },
      }),
    );
    expect(paymentSchedule(calculation).at(-1)?.payment).toBeCloseTo(calculation.lastPayment, 4);
  });

  it("100 % оплата — графика нет", () => {
    const calculation = ok(
      calculate(SIFAT_FULL, {
        price: 1,
        priceCurrency: "USD",
        downPct: 100,
        months: null,
        rate: null,
      }),
    );
    expect(paymentSchedule(calculation)).toEqual([]);
    expect(roundedSchedule([], "USD")).toEqual([]);
  });
});

describe("график на длинном сроке с мелким платежом (ревью 2.1)", () => {
  it("600 мес. по ~$24: последний платёж не уходит в минус, сумма — округлённый итог, каждый в пределах шага", () => {
    const lead = { ...SIFAT_SCHEME, overMaxBehavior: "lead" as const };
    const calculation = ok(
      calculate(lead, {
        price: 20_228.57,
        priceCurrency: "USD",
        downPct: 30,
        months: 600,
        rate: null,
      }),
    );
    expect(calculation.months).toBe(600);
    const rows = roundedSchedule(paymentSchedule(calculation), "USD");
    expect(rows.every((row) => row.payment > 0)).toBe(true);
    expect(sum(rows.map((row) => row.payment))).toBe(Math.round(calculation.financed));
    expect(rows.every((row) => Math.abs(row.payment - calculation.firstPayment) <= 1)).toBe(true);
  });
});
