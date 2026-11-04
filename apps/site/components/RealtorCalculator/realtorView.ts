import {
  type TotalContext,
  type TotalHead,
  type TotalRow,
  totalHead,
  totalRows,
} from "@/components/CalcTotal";
import type { Calculation } from "@vh/shared/calc/calculate";
import type { ExchangeRate } from "@vh/shared/calc/money";
import { DOWN_MAX_PCT } from "@vh/shared/calc/programs";
import { REALTOR_LIMITS, type RealtorInput, realtorCalculate } from "@vh/shared/calc/realtor";
import { approxIn, moneyIn, shortIn } from "@vh/shared/calc/text";
import { formatDate, formatRate } from "@vh/shared/format";
import { type RealtorState, parseAmount, parseNumber } from "./realtorState";

// Риелторский калькулятор /kalkulyator (PLAN §10, п. 48): состояние — поля как набраны, итог —
// общими calculate() и строками CalcTotal; заявка и текст для Telegram — realtorText.ts.

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Стоимость в валюте ввода: суммой или площадь × цена м². */
export function priceOf(state: RealtorState): number | null {
  if (state.priceMode === "sum") return parseAmount(state.sum);
  const area = parseNumber(state.area);
  const perM2 = parseAmount(state.perM2);
  return area === null || perM2 === null ? null : area * perM2;
}

/** Срок вкладки, мес.: ипотека и «Сколько могу купить» — годы, рассрочка — месяцы. */
export const monthsOf = (state: RealtorState) =>
  state.tab === "installment" ? state.months : state.years * 12;

export type RealtorProblem = "noPrice" | "noMonthly" | "noRate";

export function inputOf(state: RealtorState): RealtorInput | RealtorProblem {
  const price = priceOf(state) ?? 0;
  const monthly = parseAmount(state.monthly) ?? 0;
  if (state.tab === "afford" ? !(monthly > 0) : !(price > 0))
    return state.tab === "afford" ? "noMonthly" : "noPrice";
  const rate = parseNumber(state.rate);
  if (state.tab !== "installment" && rate === null) return "noRate";
  const { ratePct, markupPct } = REALTOR_LIMITS;
  return {
    mode: state.tab,
    price,
    down: parseAmount(state.first) ?? 0,
    currency: state.inCurrency,
    months: monthsOf(state),
    ratePct: clamp(rate ?? 0, ratePct.min, ratePct.max),
    method: state.method,
    markupPct: clamp(parseNumber(state.markup) ?? 0, markupPct.min, markupPct.max),
    monthly,
  };
}

export type RealtorView = {
  eyebrow: string;
  head: TotalHead | null;
  rows: TotalRow[];
  problem: string | null;
  calc: Calculation | null;
  footnotes: string[];
  /** Взнос больше 90 % — посчитано на 90 %: строка под полем взноса. */
  capped: boolean;
};

export function eyebrowOf(state: RealtorState, t: TotalContext["t"]): string {
  const method = t(`realtor.method.${state.method}`);
  return t(`realtor.eyebrow.${state.tab}`, { method });
}

const PROBLEMS = {
  noPrice: "total.noPrice",
  noMonthly: "realtor.total.noMonthly",
  noRate: "realtor.rate.empty",
} as const satisfies Record<RealtorProblem, string>;

export function realtorView(
  state: RealtorState,
  context: TotalContext,
  rate: ExchangeRate | null,
): RealtorView {
  const { t } = context;
  const eyebrow = eyebrowOf(state, t);
  const footnotes = footnotesOf(state, context, rate);
  const input = inputOf(state);
  const empty = { eyebrow, head: null, rows: [], calc: null, footnotes, capped: false };
  if (typeof input === "string") return { ...empty, problem: t(PROBLEMS[input]) };
  const result = realtorCalculate(input);
  if (!result.ok) return { ...empty, problem: t(PROBLEMS.noPrice) };
  const calc = result.calculation;
  return {
    eyebrow,
    head: headOf(state, calc, context),
    rows: rowsOf(state, calc, context),
    problem: null,
    calc,
    footnotes,
    capped: calc.downPct >= DOWN_MAX_PCT && input.down > calc.down + 0.5,
  };
}

export const money = (amount: number, calc: Calculation, context: TotalContext) =>
  moneyIn(amount, calc.currency, context.out, context.rate, context.locale);

function headOf(state: RealtorState, calc: Calculation, context: TotalContext): TotalHead {
  if (state.tab !== "afford") return totalHead(calc, context);
  const { t, out, rate, locale } = context;
  const approx = approxIn(calc.price, calc.currency, out, rate, locale);
  return {
    label: t("realtor.total.afford"),
    value: money(calc.price, calc, context),
    approx: approx === null ? null : t("total.approx", { amount: approx }),
    short: shortIn(calc.price, calc.currency, out, rate, locale),
  };
}

function rowsOf(state: RealtorState, calc: Calculation, context: TotalContext): TotalRow[] {
  const { t } = context;
  let rows = totalRows(calc, context);
  // Рассрочка без наценки: строки «Наценка 0» и «Переплата 0» ничего не говорят.
  if (calc.method === "markup" && calc.extra === 0)
    rows = rows.filter((row) => row.key !== "extra" && row.key !== "overpayment");
  if (calc.method === "differentiated") {
    const last = { key: "last", label: t("realtor.total.last"), value: money(calc.lastPayment, calc, context) };
    rows = [last, ...rows];
  }
  if (state.tab === "afford") {
    const head = totalHead(calc, context);
    const monthly = { key: "monthly", label: head.label, value: head.value };
    rows = [monthly, ...rows.filter((row) => row.key !== "price" && row.key !== "last")];
  }
  return rows;
}

/** Сноски: «иллюстративный»; курс — когда итог в другой валюте, чем ввод. */
function footnotesOf(state: RealtorState, context: TotalContext, rate: ExchangeRate | null) {
  const { t } = context;
  const notes = [t("total.disclaimer")];
  if (rate && state.inCurrency !== context.out) {
    const date = formatDate(new Date(rate.date));
    notes.push(t("total.rate", { source: rate.source, rate: formatRate(rate.usdUzs), date }));
  }
  return notes;
}
