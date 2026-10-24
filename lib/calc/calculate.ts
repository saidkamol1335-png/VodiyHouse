import { type FeeAmount, annuityPayment, differentiatedPayments, feeAmounts } from "./formulas";
import { type Currency, type ExchangeRate, convertMoney } from "./money";
import {
  type CalcProgram,
  type TieredProgram,
  type ProgramMethod,
  type TermRow,
  type TermsProgram,
  DOWN_MAX_PCT,
  isTiered,
  minDownOf,
  programCurrency,
} from "./programs";
import { type TermOutcome, resolveSchemeMonths, resolveTermRow, tierIndexFor } from "./terms";

// Расчёт одной программы (PLAN §7 фаза 2) — общий для сайта, кабинета, сравнения и «Платежа от».
// Без округления; итог = цена по программе + наценка или проценты + разовые (PLAN §7, мокап).

export type CalcInput = {
  /** Стоимость квартиры в валюте priceCurrency. */
  price: number;
  priceCurrency: Currency;
  downPct: number;
  /** null — срок по умолчанию (самый длинный из доступных). */
  months: number | null;
  rate: ExchangeRate | null;
};

export type Calculation = {
  currency: Currency;
  /** null — «100% оплата». */
  method: ProgramMethod | null;
  /** Цена в валюте расчёта. */
  price: number;
  /** Цена по программе; на сайте всегда равна price (PLAN §3.13). */
  programPrice: number;
  tierIndex: number | null;
  downPct: number;
  down: number;
  financed: number;
  months: number;
  ratePct: number | null;
  firstPayment: number;
  lastPayment: number;
  /** Наценка или проценты банка за весь срок. */
  extra: number;
  fees: FeeAmount[];
  feesTotal: number;
  total: number;
  overpayment: number;
  term: TermOutcome | null;
};

export type CalcProblem = "noPrice" | "noRate" | "noTerms";
export type CalcResult =
  { ok: true; calculation: Calculation } | { ok: false; problem: CalcProblem };

/** Цена по программе. Без неё — сама цена; кабинет передаёт свою (lib/calc/cabinet). */
export type ProgramPricing = (context: { price: number; tierIndex: number | null }) => number;

type PriceOf = (tierIndex: number | null) => number;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function calculate(
  program: CalcProgram,
  input: CalcInput,
  pricing?: ProgramPricing,
): CalcResult {
  if (!Number.isFinite(input.price) || input.price <= 0) return { ok: false, problem: "noPrice" };
  const currency = programCurrency(program, input.priceCurrency);
  const price = convertMoney(input.price, input.priceCurrency, currency, input.rate);
  if (price === null) return { ok: false, problem: "noRate" };
  const priceOf: PriceOf = (tierIndex) => pricing?.({ price, tierIndex }) ?? price;
  if (program.type === "full")
    return { ok: true, calculation: paidInFull(currency, price, priceOf) };
  if (isTiered(program)) return schemeCalculation(program, input, currency, price, priceOf);
  return termsCalculation(program, input, currency, price, priceOf(null));
}

function paidInFull(currency: Currency, price: number, priceOf: PriceOf): Calculation {
  const programPrice = priceOf(null);
  return {
    currency,
    method: null,
    price,
    programPrice,
    tierIndex: null,
    downPct: 100,
    down: programPrice,
    financed: 0,
    months: 0,
    ratePct: null,
    firstPayment: 0,
    lastPayment: 0,
    extra: 0,
    fees: [],
    feesTotal: 0,
    total: programPrice,
    overpayment: 0,
    term: null,
  };
}

/** Схема застройщика: взнос — от цены по программе, платёж — остаток / срок, наценки нет. */
function schemeCalculation(
  program: TieredProgram,
  input: CalcInput,
  currency: Currency,
  price: number,
  priceOf: PriceOf,
): CalcResult {
  if (program.tiers.length === 0) return { ok: false, problem: "noTerms" };
  const downPct = clamp(input.downPct, minDownOf(program), DOWN_MAX_PCT);
  const term = resolveSchemeMonths(program, downPct, input.months);
  if (!(term.applied >= 1)) return { ok: false, problem: "noTerms" };
  const tierIndex = tierIndexFor(program.tiers, downPct);
  const programPrice = priceOf(tierIndex);
  const down = (programPrice * downPct) / 100;
  const financed = programPrice - down;
  const payment = financed / term.applied;
  return {
    ok: true,
    calculation: {
      currency,
      method: "tiers",
      price,
      programPrice,
      tierIndex,
      downPct,
      down,
      financed,
      months: term.applied,
      ratePct: null,
      firstPayment: payment,
      lastPayment: payment,
      extra: 0,
      fees: [],
      feesTotal: 0,
      total: programPrice,
      overpayment: 0,
      term,
    },
  };
}

/** Наценка и банки: срок — строка программы, разовые — от суммы кредита. */
function termsCalculation(
  program: TermsProgram,
  input: CalcInput,
  currency: Currency,
  price: number,
  programPrice: number,
): CalcResult {
  const resolved = resolveTermRow(program, input.months);
  if (!resolved) return { ok: false, problem: "noTerms" };
  const { row, term } = resolved;
  const downPct = clamp(input.downPct, program.minDownPct, DOWN_MAX_PCT);
  const down = (programPrice * downPct) / 100;
  const financed = programPrice - down;
  const fees = feeAmounts(program.fees, financed);
  const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const { firstPayment, lastPayment, extra } = payments(program.method, financed, row);
  return {
    ok: true,
    calculation: {
      currency,
      method: program.method,
      price,
      programPrice,
      tierIndex: null,
      downPct,
      down,
      financed,
      months: row.months,
      ratePct: row.ratePct,
      firstPayment,
      lastPayment,
      extra,
      fees,
      feesTotal,
      total: programPrice + extra + feesTotal,
      overpayment: extra + feesTotal,
      term,
    },
  };
}

function payments(method: TermsProgram["method"], financed: number, row: TermRow) {
  const { months, ratePct } = row;
  if (method === "markup") {
    const extra = (financed * ratePct) / 100;
    const payment = (financed + extra) / months;
    return { firstPayment: payment, lastPayment: payment, extra };
  }
  if (method === "annuity") {
    const payment = annuityPayment(financed, ratePct, months);
    return { firstPayment: payment, lastPayment: payment, extra: payment * months - financed };
  }
  const { first, last, interest } = differentiatedPayments(financed, ratePct, months);
  return { firstPayment: first, lastPayment: last, extra: interest };
}
