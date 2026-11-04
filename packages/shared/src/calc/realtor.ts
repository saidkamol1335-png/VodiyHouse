import { type CalcResult, calculate } from "./calculate";
import { monthlyRate } from "./formulas";
import type { Currency } from "./money";
import { DOWN_MAX_PCT, type TermsProgram } from "./programs";
import { APP_TIME_ZONE } from "../format";

// Риелторский калькулятор /kalkulyator (PLAN §10, п. 48): условия вводит сам посетитель, программ
// застройщика нет. Ипотека и рассрочка считаются общим calculate() по программе из одной строки
// сроков — те же формулы, график и округление, что у квартиры.

export type RealtorMode = "mortgage" | "installment" | "afford";
export type RealtorMethod = "annuity" | "differentiated";

export const REALTOR_MODES: readonly RealtorMode[] = ["mortgage", "installment", "afford"];

/** Границы полей: ипотека — в годах, рассрочка — в месяцах (п. 48). */
export const REALTOR_LIMITS = {
  years: { min: 1, max: 25, presets: [5, 10, 15, 20] },
  months: { min: 3, max: 60, presets: [12, 24, 36, 48] },
  ratePct: { min: 0, max: 60 },
  markupPct: { min: 0, max: 100 },
  downPresets: [10, 20, 30, 40],
} as const;

export type RealtorInput = {
  mode: RealtorMode;
  /** Цена квартиры (ипотека, рассрочка) в валюте currency. */
  price: number;
  /** Первоначальный взнос суммой в валюте currency. */
  down: number;
  currency: Currency;
  /** Срок, мес. (у ипотеки — годы × 12). */
  months: number;
  /** Годовая ставка банка, % (ипотека и «Сколько могу купить»). */
  ratePct: number;
  method: RealtorMethod;
  /** Наценка на остаток за весь срок, % (рассрочка). */
  markupPct: number;
  /** Платёж в месяц («Сколько могу купить»). */
  monthly: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Программа из одной строки сроков под ввод посетителя. */
export function realtorProgram(input: RealtorInput): TermsProgram {
  const installment = input.mode === "installment";
  return {
    type: installment ? "installment" : "mortgage",
    method: installment ? "markup" : input.method,
    minDownPct: 0,
    terms: [{ months: input.months, ratePct: installment ? input.markupPct : input.ratePct }],
    fees: [],
    currency: null,
  };
}

/** Взнос в % от цены; выше DOWN_MAX_PCT — уже не кредит, calculate() его ограничит. */
export function downPctOf(down: number, price: number): number {
  if (!(price > 0) || !(down > 0)) return 0;
  return clamp((down / price) * 100, 0, DOWN_MAX_PCT);
}

/** Ипотека и рассрочка: расчёт общим calculate(); «Сколько могу купить» — через доступную цену. */
export function realtorCalculate(input: RealtorInput): CalcResult {
  const price = input.mode === "afford" ? affordablePrice(input) : input.price;
  const down = input.mode === "afford" ? Math.min(input.down, price) : input.down;
  return calculate(realtorProgram(input), {
    price,
    priceCurrency: input.currency,
    downPct: downPctOf(down, price),
    months: input.months,
    rate: null,
  });
}

/**
 * Сколько можно взять в кредит при платеже monthly: аннуитет — S = M × (1 − (1 + r)^−n) / r
 * (при 0 % — M × n); дифференцированный — по первому, самому большому платежу: S = M / (1/n + r).
 */
export function affordableLoan(
  monthly: number,
  annualRatePct: number,
  months: number,
  method: RealtorMethod,
): number {
  if (!(monthly > 0) || !(months >= 1)) return 0;
  const rate = monthlyRate(annualRatePct);
  if (rate === 0) return monthly * months;
  if (method === "differentiated") return monthly / (1 / months + rate);
  return (monthly * (1 - Math.pow(1 + rate, -months))) / rate;
}

/**
 * Доступная цена: кредит + взнос. Взнос выше DOWN_MAX_PCT от цены расчёт не примет, поэтому
 * кредит не меньше (100 − DOWN_MAX_PCT) % цены: иначе цена — по кредиту, взнос урезается.
 */
export function affordablePrice(
  input: Pick<RealtorInput, "monthly" | "ratePct" | "months" | "method" | "down">,
): number {
  const loan = affordableLoan(input.monthly, input.ratePct, input.months, input.method);
  if (!(loan > 0)) return 0;
  const down = Math.max(0, input.down);
  const minLoanShare = (100 - DOWN_MAX_PCT) / 100;
  return Math.min(loan + down, loan / minLoanShare);
}

/** Взнос по кнопке «N %»: от цены, а у «Сколько могу купить» — от будущей цены (цена = кредит / (1 − p)). */
export function downForPct(
  pct: number,
  input: Pick<RealtorInput, "mode" | "price" | "monthly" | "ratePct" | "months" | "method">,
): number {
  const share = clamp(pct, 0, DOWN_MAX_PCT) / 100;
  if (input.mode !== "afford") return Math.max(0, input.price) * share;
  const loan = affordableLoan(input.monthly, input.ratePct, input.months, input.method);
  return (loan * share) / (1 - share);
}

/** Месяц первого платежа — следующий за текущим по времени Ташкента: «2026-12». */
export function firstPaymentMonth(now: Date): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: APP_TIME_ZONE,
  })
    .format(now)
    .split("-")
    .map(Number);
  return month === 12 ? `${year! + 1}-01` : `${year}-${String(month! + 1).padStart(2, "0")}`;
}

/** Дата платежа № index (с 1) — первое число месяца; полдень UTC — тот же день и в Ташкенте. */
export function paymentDate(firstMonth: string, index: number): Date {
  const [year, month] = firstMonth.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1 + index - 1, 1, 12));
}
