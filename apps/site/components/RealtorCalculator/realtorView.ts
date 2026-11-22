import type { TotalContext, TotalHead, TotalRow } from "@/components/CalcTotal";
import type { Calculation } from "@vh/shared/calc/calculate";
import type { ExchangeRate } from "@vh/shared/calc/money";
import { DOWN_MAX_PCT } from "@vh/shared/calc/programs";
import {
  REALTOR_LIMITS,
  type RealtorInput,
  affordableLoan,
  affordablePrice,
  realtorCalculate,
} from "@vh/shared/calc/realtor";
import { type RealtorFigures, affordPriceShown, realtorFigures } from "@vh/shared/calc/realtorFigures";
import { approxIn, moneyIn, shortIn, termText } from "@vh/shared/calc/text";
import { formatDate, formatPercent, formatPriceExact, formatRate } from "@vh/shared/format";
import { type RealtorState, parseAmount, parseNumber } from "./realtorState";

// Риелторский калькулятор /kalkulyator (PLAN §10, п. 48): состояние — поля как набраны; расчёт —
// общим calculate() (графики), а числа итога — по правилам uysot.uz до сума (realtorFigures, 22.11):
// платёж и суммы — сотнями, проценты — до сума, «Общая сумма» = кредит + проценты. Заявка и текст
// для Telegram — realtorText.ts.

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Стоимость в валюте ввода: суммой или площадь × цена м². */
export function priceOf(state: RealtorState): number | null {
  if (state.priceMode === "sum") return parseAmount(state.sum);
  const area = parseNumber(state.area);
  const perM2 = parseAmount(state.perM2);
  // 32,3 × 5 300 000 = 171 189 999,99999997 — без шума float, иначе «Стоимость» до сума покажет …999.
  return area === null || perM2 === null ? null : Math.round(area * perM2 * 100) / 100;
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
  /**
   * Платёж ипотеки до сума — переходит в поле «Платёж в месяц» вкладки «Сколько могу купить» (как uysot
   * с «Ипотеки» на «Оплату»); с рассрочки — нет: её срок и наценка там не действуют.
   */
  monthlyFloor: number | null;
  /** Числа итога — ими же «Всего» в графике, чтобы на странице был один итог. */
  figures: RealtorFigures | null;
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
  const empty = { eyebrow, monthlyFloor: null, figures: null, head: null, rows: [], calc: null, footnotes, capped: false };
  if (typeof input === "string") return { ...empty, problem: t(PROBLEMS[input]) };
  const result = realtorCalculate(input);
  if (!result.ok) return { ...empty, problem: t(PROBLEMS.noPrice) };
  const calc = result.calculation;
  const shown = shownOf(input);
  return {
    eyebrow,
    monthlyFloor: state.tab === "mortgage" ? shown.figures.monthlyFloor : null,
    figures: shown.figures,
    head: headOf(state, calc, shown, context),
    rows: rowsOf(state, calc, shown, context),
    problem: null,
    calc,
    footnotes,
    capped: calc.downPct >= DOWN_MAX_PCT && input.down > calc.down + 0.5,
  };
}

export const money = (amount: number, calc: Calculation, context: TotalContext) =>
  moneyIn(amount, calc.currency, context.out, context.rate, context.locale);

/** Сумма итога: в валюте ввода — до сума (как uysot), в другой валюте — по курсу шагом той валюты. */
export const shownMoney = (amount: number, calc: Calculation, context: TotalContext) =>
  calc.currency === context.out
    ? formatPriceExact(amount, calc.currency, context.locale)
    : money(amount, calc, context);

/** Числа итога по правилам uysot и то, от чего они посчитаны (цена, взнос, платёж посетителя). */
export type RealtorShown = { figures: RealtorFigures; price: number; down: number; monthly: number };

/**
 * Итог к выводу — из ввода посетителя, а не из calc (там взнос через downPct, с шумом float): кредит =
 * цена − взнос (не больше DOWN_MAX_PCT); у «Сколько могу купить» — floor(кредит + взнос) − взнос, а
 * цена — вверх до миллиона (uysot).
 */
export function shownOf(input: RealtorInput): RealtorShown {
  const kind = input.mode === "installment" ? "installment" : input.method;
  const ratePct = input.mode === "installment" ? input.markupPct : input.ratePct;
  const figuresOf = (credit: number) => realtorFigures(kind, credit, ratePct, input.months, input.currency);
  if (input.mode === "afford") {
    const loan = affordableLoan(input.monthly, input.ratePct, input.months, input.method);
    const exact = affordablePrice(input);
    const wanted = Math.max(0, input.down);
    // Взнос больше DOWN_MAX_PCT цены: цена — по кредиту, взнос урезан (affordablePrice).
    const down = exact < loan + wanted ? exact - loan : wanted;
    const pv = input.currency === "UZS" ? Math.floor(exact) : exact;
    const price = affordPriceShown(pv, input.currency);
    return { figures: figuresOf(pv - down), price, down, monthly: input.monthly };
  }
  const down = Math.min(Math.max(0, input.down), (input.price * DOWN_MAX_PCT) / 100);
  return { figures: figuresOf(input.price - down), price: input.price, down, monthly: input.monthly };
}

function headOf(state: RealtorState, calc: Calculation, shown: RealtorShown, context: TotalContext): TotalHead {
  const { t, out, rate, locale } = context;
  const afford = state.tab === "afford";
  const amount = afford ? shown.price : shown.figures.monthly;
  const label = afford
    ? t("realtor.total.afford")
    : calc.method === "differentiated"
      ? t("total.first")
      : t("total.monthly");
  const approx = approxIn(amount, calc.currency, out, rate, locale);
  return {
    label,
    value: shownMoney(amount, calc, context),
    approx: approx === null ? null : t("total.approx", { amount: approx }),
    short: shortIn(amount, calc.currency, out, rate, locale),
  };
}

/**
 * Строки итога как у uysot: «Сумма кредита», «Проценты банка», «Общая сумма» (кредит + проценты, без
 * взноса); сверху — от чего считали (стоимость или платёж, взнос). Рассрочка без наценки — только итог.
 */
function rowsOf(state: RealtorState, calc: Calculation, shown: RealtorShown, context: TotalContext): TotalRow[] {
  const { t } = context;
  const { figures } = shown;
  const sum = (amount: number) => shownMoney(amount, calc, context);
  const values = { rate: formatPercent(calc.ratePct ?? 0), term: termText(calc.months, t) };
  const down = { key: "down", label: t("total.down", { pct: formatPercent(calc.downPct) }), value: sum(shown.down) };
  const start: TotalRow[] =
    state.tab === "afford"
      ? [{ key: "monthly", label: t("total.monthly"), value: sum(shown.monthly) }, down]
      : [{ key: "price", label: t("total.price"), value: sum(shown.price) }, down];
  const markup = calc.method === "markup";
  const sumNote = !markup ? "sumLoan" : figures.interest > 0 ? "sumMarkup" : "sumRest";
  const total: TotalRow = {
    key: "total",
    label: t("realtor.total.sum"),
    note: t(`realtor.total.${sumNote}`),
    value: sum(figures.total),
    tone: "accent",
  };
  if (markup) return [...start, ...markupRows(figures, sum, t, values), total];
  const last: TotalRow[] =
    calc.method === "differentiated" && state.tab !== "afford"
      ? [{ key: "last", label: t("realtor.total.last"), value: sum(figures.last) }]
      : [];
  const interest: TotalRow = {
    key: "extra",
    label: t("total.interest"),
    note: t("total.interestNote", values),
    hint: "bank-interest",
    value: sum(figures.interest),
  };
  const loan = { key: "loan", label: t("total.loan"), value: sum(figures.loan) };
  return [...last, ...start, loan, interest, total];
}

/** Рассрочка: при наценке — остаток и наценка; без неё строки «0» ничего не говорят. */
function markupRows(
  figures: RealtorFigures,
  sum: (amount: number) => string,
  t: TotalContext["t"],
  values: { rate: string; term: string },
): TotalRow[] {
  if (!(figures.interest > 0)) return [];
  return [
    { key: "loan", label: t("total.rest"), value: sum(figures.loan) },
    {
      key: "extra",
      label: t("total.markup"),
      note: t("total.markupNote", values),
      hint: "markup",
      value: sum(figures.interest),
    },
  ];
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
