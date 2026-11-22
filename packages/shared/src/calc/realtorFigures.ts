import type { Calculation } from "./calculate";
import { monthlyRate } from "./formulas";
import type { Currency } from "./money";
import type { RealtorMethod } from "./realtor";
import { type ScheduleRow, paymentSchedule } from "./schedule";

// Риелторский калькулятор /kalkulyator считает «точь в точь» как uysot.uz/mortgage-calculator
// (поручение исполнителя 22.11; разбор кода uysot — docs/progress/realtor-calc.md, 22.11):
// - каждая сумма сначала Math.floor, затем к выводу — до сотни сумов, остаток ≥ 50 — вверх;
// - проценты — до сума, без сотен;
// - «Общая сумма» — кредит + проценты (взнос не входит);
// - «Сколько могу купить» — цена вверх до целого миллиона, кредит и проценты — от неокруглённой.
// Порядок действий в аннуитете — как у uysot (formulas.ts): float совпадает до сума.
// Доллары (у uysot их нет): без floor и сотен — один раз округляет вывод (formatPrice, moneyIn), как
// и график; перенос платежа на «Сколько могу купить» — с центами (ревью 22.11).

/** Шаг вывода uysot: до сотни, «≥ 50 — вверх» (как у uysot: остаток JS-%, отрицательные — к нулю). */
export function round100(value: number): number {
  const rest = value % 100;
  return (rest >= 50 ? value - rest + 100 : value - rest) + 0;
}

const same = (value: number) => value;
/** Правила uysot — только для сумов: floor, затем сотни; доллары — как посчитаны. */
const rulesOf = (currency: Currency) =>
  currency === "UZS"
    ? { whole: Math.floor, step: round100, carry: Math.floor }
    : { whole: same, step: same, carry: (value: number) => Math.round(value * 100) / 100 };

/** Числа итога к выводу: уже округлены (сум — сотни, проценты — до сума), вывод их не трогает. */
export type RealtorFigures = {
  /** Платёж в месяц; у дифференцированного — первый. */
  monthly: number;
  /** Тот же платёж до сума, без сотен: его uysot переносит на вкладку «Оплата». */
  monthlyFloor: number;
  /** Последний платёж дифференцированного; у остальных — тот же, что monthly. */
  last: number;
  loan: number;
  /** Проценты банка или наценка за весь срок. */
  interest: number;
  /** Общая сумма: кредит + проценты (наценка). */
  total: number;
};

/** Аннуитет uysot без округления: i·(1+i)^n·c / ((1+i)^n − 1); при 0 % — c / n. */
export function uysotAnnuity(credit: number, annualRatePct: number, months: number): number {
  const rate = monthlyRate(annualRatePct);
  if (rate === 0) return credit / months;
  const growth = Math.pow(1 + rate, months);
  return (rate * growth * credit) / (growth - 1);
}

/** Ипотека, аннуитет (вкладка uysot «Ипотека»). */
export function annuityFigures(
  credit: number,
  annualRatePct: number,
  months: number,
  currency: Currency,
): RealtorFigures {
  const { whole, step, carry } = rulesOf(currency);
  const loan = step(whole(credit));
  if (monthlyRate(annualRatePct) === 0) {
    const monthly = step(whole(credit / months));
    return { monthly, monthlyFloor: carry(credit / months), last: monthly, loan, interest: 0, total: step(credit) };
  }
  const payment = uysotAnnuity(credit, annualRatePct, months);
  const monthly = step(whole(payment));
  return {
    monthly,
    monthlyFloor: carry(payment),
    last: monthly,
    loan,
    interest: whole(payment * months - credit),
    total: step(whole(payment * months)),
  };
}

/** Дифференцированный (у uysot его нет): те же правила — floor, затем сотни; проценты до сума. */
export function differentiatedFigures(
  credit: number,
  annualRatePct: number,
  months: number,
  currency: Currency,
): RealtorFigures {
  const { whole, step, carry } = rulesOf(currency);
  const rate = monthlyRate(annualRatePct);
  const principal = credit / months;
  const interest = (credit * rate * (months + 1)) / 2;
  const first = principal + credit * rate;
  return {
    monthly: step(whole(first)),
    monthlyFloor: carry(first),
    last: step(whole(principal * (1 + rate))),
    loan: step(whole(credit)),
    interest: whole(interest),
    total: step(whole(credit + interest)),
  };
}

/** Рассрочка (вкладка uysot «Рассрочка»): остаток / срок; наценка — наше дополнение, при 0 % — как uysot. */
export function installmentFigures(
  credit: number,
  markupPct: number,
  months: number,
  currency: Currency,
): RealtorFigures {
  const { whole, step, carry } = rulesOf(currency);
  const markup = (credit * markupPct) / 100;
  const payment = (credit + markup) / months;
  const monthly = step(whole(payment));
  return {
    monthly,
    monthlyFloor: carry(payment),
    last: monthly,
    loan: step(whole(credit)),
    interest: whole(markup),
    total: step(credit + markup),
  };
}

/**
 * Сколько можно взять в кредит при платеже monthly, в записи uysot: m·((1+i)^n − 1) / (i·(1+i)^n);
 * при 0 % — m·n; дифференцированный — по первому платежу: m / (1/n + i).
 */
export function uysotLoan(monthly: number, annualRatePct: number, months: number, method: RealtorMethod): number {
  if (!(monthly > 0) || !(months >= 1)) return 0;
  const rate = monthlyRate(annualRatePct);
  if (rate === 0) return monthly * months;
  if (method === "differentiated") return monthly / (1 / months + rate);
  const growth = Math.pow(1 + rate, months);
  return (monthly * (growth - 1)) / (rate * growth);
}

/** Цена «Сколько могу купить» к выводу: сум — вверх до миллиона (uysot), доллары — как есть. */
export function affordPriceShown(pvFloor: number, currency: Currency): number {
  return currency === "UZS" ? Math.ceil(pvFloor / 1e6) * 1e6 : pvFloor;
}

/** Итог по методу: ипотека — аннуитет или дифференцированный, рассрочка — с наценкой. */
export function realtorFigures(
  kind: "annuity" | "differentiated" | "installment",
  credit: number,
  ratePct: number,
  months: number,
  currency: Currency,
): RealtorFigures {
  if (kind === "installment") return installmentFigures(credit, ratePct, months, currency);
  if (kind === "differentiated") return differentiatedFigures(credit, ratePct, months, currency);
  return annuityFigures(credit, ratePct, months, currency);
}

/** Сумма строки графика к выводу, как у uysot: floor(Number(x.toFixed(2))). */
export const scheduleFloor = (value: number) => Math.floor(Number(value.toFixed(2))) + 0;

/** График uysot: строки без шага вывода, каждая сумма — scheduleFloor (последний платёж не подгоняется). */
export function exactSchedule(calc: Calculation): ScheduleRow[] {
  return paymentSchedule(calc).map((row) => ({
    month: row.month,
    payment: scheduleFloor(row.payment),
    principal: scheduleFloor(row.principal),
    interest: scheduleFloor(row.interest),
    balance: scheduleFloor(row.balance),
  }));
}
