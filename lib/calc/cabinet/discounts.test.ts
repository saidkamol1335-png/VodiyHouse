import path from "node:path";
import { describe, expect, it } from "vitest";
import { reachableModules, routeFiles } from "@/tests/unit/importGraph";
import { MOCKUP_RATE, SIFAT_FULL, SIFAT_IPOTEKA_MORTGAGE, SIFAT_SCHEME } from "../fixtures";
import { roundMoney } from "../money";
import {
  calculateWithDiscount,
  discountAmount,
  compareWithDiscount,
  discountPctOf,
  schemeOptions,
} from "./discounts";

// Скидки — только в кабинете (PLAN §3.13, §3б).

const input = {
  price: 84_000,
  priceCurrency: "USD" as const,
  downPct: 20,
  months: 24,
  rate: MOCKUP_RATE,
};

describe("скидки кабинета", () => {
  it("скидка по ступени взноса и за 100 %; у банков — нет", () => {
    expect(discountPctOf(SIFAT_SCHEME, 0)).toBe(0);
    expect(discountPctOf(SIFAT_SCHEME, 1)).toBe(6);
    expect(discountPctOf(SIFAT_SCHEME, null)).toBe(0);
    expect(discountPctOf(SIFAT_FULL, null)).toBe(12);
    expect(discountPctOf(SIFAT_IPOTEKA_MORTGAGE, null)).toBe(0);
  });

  it("взнос считается от цены со скидкой (мокап, тест PLAN): 50 % → $47 000 из $94 000", () => {
    const result = calculateWithDiscount(SIFAT_SCHEME, { ...input, price: 100_000, downPct: 50 });
    expect(result.ok && result.calculation.down).toBe(47_000);
  });

  it("карточки вариантов: «30 % → −0 % · до 36», …, «100 % → −12 %» из программы 100 %", () => {
    expect(schemeOptions(SIFAT_SCHEME, SIFAT_FULL)).toEqual([
      { downPct: 30, discountPct: 0, maxMonths: 36 },
      { downPct: 50, discountPct: 6, maxMonths: 18 },
      { downPct: 70, discountPct: 9, maxMonths: 12 },
      { downPct: 100, discountPct: 12, maxMonths: null },
    ]);
    expect(schemeOptions(SIFAT_SCHEME, null)).toHaveLength(3);
  });

  it("сравнение со скидками (SiteCalc1 до PLAN v4): 100 % → 872 904 000 сум — выгоднее всего", () => {
    const { rows } = compareWithDiscount([SIFAT_FULL, SIFAT_SCHEME], input);
    const full = rows.find((row) => row.program === SIFAT_FULL)!;
    expect(full.cheapest).toBe(true);
    expect(rows.find((row) => row.program === SIFAT_SCHEME)?.cheapest).toBe(false);
    const inSum = full.calculation.total * MOCKUP_RATE.usdUzs;
    expect(roundMoney(inSum, "UZS")).toBe(872_904_000);
  });

  it("сайт не импортирует скидки: из маршрутов app/[locale] модуль недостижим", () => {
    const cabinetDir = path.join("lib", "calc", "cabinet");
    const reached = reachableModules(routeFiles("app/[locale]")).map((file) =>
      path.relative(process.cwd(), file),
    );
    expect(reached.length).toBeGreaterThan(0);
    expect(reached.filter((file) => file.startsWith(cabinetDir))).toEqual([]);
  });
});

describe("скидка в деньгах для строки «Скидка за взнос»", () => {
  it("цена по прайсу минус цена по программе; без скидки — 0, не минус", () => {
    expect(discountAmount({ price: 57_880, programPrice: 54_407.2 })).toBeCloseTo(3472.8);
    expect(discountAmount({ price: 41_400, programPrice: 41_400 })).toBe(0);
  });
});
