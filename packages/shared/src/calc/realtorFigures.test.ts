import { describe, expect, it } from "vitest";
import { affordableLoan, affordablePrice } from "./realtor";
import {
  affordPriceShown,
  annuityFigures,
  differentiatedFigures,
  installmentFigures,
  round100,
  scheduleFloor,
  uysotAnnuity,
} from "./realtorFigures";

// Сверка с uysot.uz/mortgage-calculator (код страницы разобран и проверен живыми расчётами 22.11).

describe("round100 — шаг вывода uysot", () => {
  it("до сотни, остаток ≥ 50 — вверх", () => {
    expect(round100(7_524_709)).toBe(7_524_700);
    expect(round100(5_952_380)).toBe(5_952_400);
    expect(round100(8_333_333)).toBe(8_333_300);
    expect(round100(1_805_930_350)).toBe(1_805_930_400);
    expect(round100(1_805_930_349)).toBe(1_805_930_300);
    expect(round100(0)).toBe(0);
  });
});

describe("Ипотека — как вкладка uysot «Ипотека»", () => {
  it("600 млн, взнос 100 млн, 20 лет, 17,5 %: 7 524 700 · 500 000 000 · 1 305 930 315 · 1 805 930 300", () => {
    expect(Math.floor(uysotAnnuity(500_000_000, 17.5, 240))).toBe(7_524_709);
    expect(annuityFigures(500_000_000, 17.5, 240, "UZS")).toEqual({
      monthly: 7_524_700,
      monthlyFloor: 7_524_709,
      last: 7_524_700,
      loan: 500_000_000,
      interest: 1_305_930_315,
      total: 1_805_930_300,
    });
  });

  it("ставка 0 — остаток / срок, процентов нет, общая сумма = кредит", () => {
    const figures = annuityFigures(500_000_000, 0, 60, "UZS");
    expect(figures).toMatchObject({ monthly: 8_333_300, monthlyFloor: 8_333_333, interest: 0, total: 500_000_000 });
  });

  it("доллары — без floor и сотен: округляет только вывод, как в графике; перенос — с центами", () => {
    const figures = annuityFigures(40_000, 17.5, 240, "USD");
    expect(figures.monthly).toBe(uysotAnnuity(40_000, 17.5, 240));
    expect(figures.monthlyFloor).toBe(601.98);
  });
});

describe("Рассрочка — как вкладка uysot «Рассрочка»", () => {
  it("600 млн, взнос 100 млн, 5 лет: 8 333 300, общая сумма 500 000 000", () => {
    expect(installmentFigures(500_000_000, 0, 60, "UZS")).toMatchObject({ monthly: 8_333_300, total: 500_000_000, interest: 0 });
  });

  it("7 лет: 5 952 400 (остаток ≥ 50 — вверх)", () => {
    expect(installmentFigures(500_000_000, 0, 84, "UZS").monthly).toBe(5_952_400);
  });

  it("наценка (наше дополнение): платёж и общая сумма с наценкой, наценка до сума", () => {
    expect(installmentFigures(500_000_000, 10, 60, "UZS")).toMatchObject({ monthly: 9_166_700, interest: 50_000_000, total: 550_000_000 });
  });
});

describe("Сколько могу купить — как вкладка uysot «Оплата»", () => {
  const afford = (monthly: number, down: number, ratePct: number, months: number) => {
    const input = { monthly, down, ratePct, months, method: "annuity" as const };
    const pv = Math.floor(affordablePrice(input));
    const credit = pv - down;
    return { pv, price: affordPriceShown(pv, "UZS"), ...annuityFigures(credit, ratePct, months, "UZS") };
  };

  it("7 524 709 · 100 млн · 20 лет · 17,5 %: 600 000 000 · 500 000 000 · 1 305 930 202 · 1 805 930 200", () => {
    expect(afford(7_524_709, 100_000_000, 17.5, 240)).toMatchObject({
      pv: 599_999_957,
      price: 600_000_000,
      loan: 500_000_000,
      interest: 1_305_930_202,
      total: 1_805_930_200,
    });
  });

  it("8 333 333 · 100 млн · 5 лет · 0 %: 600 000 000 · 500 000 000 · 0 · 500 000 000", () => {
    expect(afford(8_333_333, 100_000_000, 0, 60)).toMatchObject({
      pv: 599_999_980,
      price: 600_000_000,
      loan: 500_000_000,
      interest: 0,
      total: 500_000_000,
    });
  });

  it("цена — вверх до целого миллиона, доллары — как есть", () => {
    expect(affordPriceShown(599_000_001, "UZS")).toBe(600_000_000);
    expect(affordPriceShown(600_000_000, "UZS")).toBe(600_000_000);
    expect(affordPriceShown(41_234, "USD")).toBe(41_234);
  });

  it("кредит — формула uysot m·((1+i)^n − 1) / (i·(1+i)^n)", () => {
    expect(Math.floor(affordableLoan(7_524_709, 17.5, 240, "annuity") + 100_000_000)).toBe(599_999_957);
  });
});

describe("дифференцированный (у uysot нет) — те же правила вывода", () => {
  it("первый и последний платёж сотнями, проценты до сума, общая сумма = кредит + проценты", () => {
    const figures = differentiatedFigures(500_000_000, 17.5, 240, "UZS");
    // первый: 500 млн / 240 + 500 млн × 0,175 / 12 = 2 083 333,3 + 7 291 666,7 = 9 375 000
    expect(figures.monthly).toBe(9_375_000);
    expect(figures.interest).toBe(Math.floor((500_000_000 * (17.5 / 100 / 12) * 241) / 2));
    expect(figures.total).toBe(round100(Math.floor(500_000_000 + figures.interest)));
  });
});

describe("график — как у uysot", () => {
  it("floor(Number(x.toFixed(2)))", () => {
    expect(scheduleFloor(7_524_709.646)).toBe(7_524_709);
    expect(scheduleFloor(233_042.999)).toBe(233_043);
    expect(scheduleFloor(-0.001)).toBe(0);
  });
});
