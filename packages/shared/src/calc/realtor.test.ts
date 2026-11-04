import { describe, expect, it } from "vitest";
import type { Calculation } from "./calculate";
import {
  type RealtorInput,
  affordableLoan,
  firstPaymentMonth,
  paymentDate,
  affordablePrice,
  downForPct,
  downPctOf,
  realtorCalculate,
} from "./realtor";
import { paymentSchedule, roundedSchedule } from "./schedule";
import { formatDate } from "../format";

// Риелторский калькулятор (PLAN §10, п. 48). Сверка — с uysot.uz/mortgage-calculator 04.11.2026:
// 600 млн, взнос 100 млн, 20 лет, 17,5 % → 7 524 709 сум в месяц (uysot отбрасывает дробь),
// проценты 1 305 930 315 сум.

const base: RealtorInput = {
  mode: "mortgage",
  price: 600_000_000,
  down: 100_000_000,
  currency: "UZS",
  months: 240,
  ratePct: 17.5,
  method: "annuity",
  markupPct: 0,
  monthly: 0,
};

function ok(input: RealtorInput): Calculation {
  const result = realtorCalculate(input);
  if (!result.ok) throw new Error(result.problem);
  return result.calculation;
}

describe("ипотека", () => {
  it("аннуитет совпадает с uysot: 7 524 709 сум, проценты 1 305 930 315 сум", () => {
    const calc = ok(base);
    expect(calc.financed).toBeCloseTo(500_000_000, 2);
    expect(Math.floor(calc.firstPayment)).toBe(7_524_709);
    expect(Math.round(calc.extra)).toBe(1_305_930_315);
    expect(Math.round(calc.total)).toBe(600_000_000 + 1_305_930_315);
  });

  it("первая строка графика как у uysot: проценты 7 291 666, долг 233 042", () => {
    const [first] = paymentSchedule(ok(base));
    expect(Math.floor(first!.interest)).toBe(7_291_666);
    expect(Math.floor(first!.principal)).toBe(233_042);
  });

  it("дифференцированный: первый платёж = S/n + S × r, переплата = S × r × (n + 1) / 2", () => {
    const calc = ok({ ...base, method: "differentiated" });
    const rate = 17.5 / 12 / 100;
    expect(calc.firstPayment).toBeCloseTo(500_000_000 / 240 + 500_000_000 * rate, 4);
    expect(calc.extra).toBeCloseTo((500_000_000 * rate * 241) / 2, 2);
    expect(calc.lastPayment).toBeLessThan(calc.firstPayment);
  });

  it("ставка 0 % — равные платежи без переплаты", () => {
    const calc = ok({ ...base, ratePct: 0 });
    expect(calc.firstPayment).toBeCloseTo(500_000_000 / 240, 6);
    expect(calc.overpayment).toBe(0);
  });

  it("график к выводу: сумма платежей = итог по кредиту, округлено до тысячи", () => {
    const rows = roundedSchedule(paymentSchedule(ok(base)), "UZS");
    expect(rows).toHaveLength(240);
    expect(rows.every((row) => row.payment % 1000 === 0)).toBe(true);
    const paid = rows.reduce((sum, row) => sum + row.payment, 0);
    expect(paid).toBe(Math.round((500_000_000 + 1_305_930_315) / 1000) * 1000);
  });
});

describe("рассрочка", () => {
  const installment: RealtorInput = { ...base, mode: "installment", months: 60 };

  it("без наценки — как у uysot: 500 млн / 60 = 8 333 333 сум", () => {
    const calc = ok(installment);
    expect(Math.round(calc.firstPayment)).toBe(8_333_333);
    expect(calc.total).toBeCloseTo(600_000_000, 4);
    expect(calc.overpayment).toBe(0);
  });

  it("наценка 10 % на остаток: +50 млн, платёж 550 млн / 60", () => {
    const calc = ok({ ...installment, markupPct: 10 });
    expect(calc.extra).toBeCloseTo(50_000_000, 4);
    expect(calc.firstPayment).toBeCloseTo(550_000_000 / 60, 4);
    expect(calc.total).toBeCloseTo(650_000_000, 4);
  });

  it("ставка ипотеки на рассрочку не влияет", () => {
    expect(ok({ ...installment, ratePct: 30 }).firstPayment).toBeCloseTo(500_000_000 / 60, 4);
  });
});

describe("сколько могу купить", () => {
  const afford: RealtorInput = {
    ...base,
    mode: "afford",
    price: 0,
    monthly: 8_333_333,
    months: 60,
    ratePct: 0,
  };

  it("как у uysot: 8 333 333 × 60 под 0 % + взнос 100 млн ≈ 600 млн", () => {
    expect(affordablePrice(afford)).toBeCloseTo(8_333_333 * 60 + 100_000_000, 4);
  });

  it("обратный расчёт сходится с прямым: платёж по найденной цене = заданному", () => {
    const input = { ...afford, ratePct: 17.5, months: 240, monthly: 7_524_709 };
    const calc = ok(input);
    expect(calc.price).toBeCloseTo(600_000_000, -3);
    expect(calc.firstPayment).toBeCloseTo(7_524_709, 2);
  });

  it("дифференцированный — по первому платежу", () => {
    const input = { ...afford, ratePct: 24, months: 120, method: "differentiated" as const };
    const calc = ok(input);
    expect(calc.firstPayment).toBeCloseTo(8_333_333, 2);
  });

  it("взнос больше 90 % цены: цена — по кредиту, взнос урезан до 90 %", () => {
    const input = { ...afford, monthly: 1_000_000, months: 10, down: 1_000_000_000 };
    const price = affordablePrice(input);
    expect(price).toBeCloseTo(100_000_000, 4);
    const calc = ok(input);
    expect(calc.downPct).toBe(90);
    expect(calc.firstPayment).toBeCloseTo(1_000_000, 4);
  });

  it("без платежа — ноль, расчёт сообщает «нет цены»", () => {
    expect(affordableLoan(0, 17.5, 240, "annuity")).toBe(0);
    expect(realtorCalculate({ ...afford, monthly: 0, down: 0 })).toEqual({
      ok: false,
      problem: "noPrice",
    });
  });
});

describe("взнос", () => {
  it("процент от цены, не выше 90 %", () => {
    expect(downPctOf(100_000_000, 600_000_000)).toBeCloseTo(16.667, 3);
    expect(downPctOf(700_000_000, 600_000_000)).toBe(90);
    expect(downPctOf(5, 0)).toBe(0);
  });

  it("кнопка «20 %»: от цены, а у «Сколько могу купить» — 20 % будущей цены", () => {
    expect(downForPct(20, base)).toBe(120_000_000);
    const afford = { ...base, mode: "afford" as const, monthly: 8_000_000, ratePct: 0, months: 60 };
    const down = downForPct(20, afford);
    const price = affordablePrice({ ...afford, down });
    expect(down / price).toBeCloseTo(0.2, 10);
  });
});

describe("даты графика", () => {
  it("первый платёж — 1-го числа следующего месяца по Ташкенту", () => {
    expect(firstPaymentMonth(new Date("2026-11-04T10:00:00Z"))).toBe("2026-12");
    expect(firstPaymentMonth(new Date("2026-12-31T20:00:00Z"))).toBe("2027-02");
    expect(firstPaymentMonth(new Date("2026-12-15T00:00:00Z"))).toBe("2027-01");
  });

  it("платёж № 1 — 01.12.2026, № 2 — 01.01.2027, № 240 — 01.11.2046", () => {
    expect(formatDate(paymentDate("2026-12", 1))).toBe("01.12.2026");
    expect(formatDate(paymentDate("2026-12", 2))).toBe("01.01.2027");
    expect(formatDate(paymentDate("2026-12", 240))).toBe("01.11.2046");
  });
});
