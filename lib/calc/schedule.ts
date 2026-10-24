import type { Calculation } from "./calculate";
import { monthlyRate } from "./formulas";
import { type Currency, convertMoney, type ExchangeRate, roundMoney } from "./money";

// График платежей (PLAN §7 фаза 2). Считается без округления; к выводу платежи округляются шагом
// валюты, а последний забирает разницу и остаётся кратным шагу.

export type ScheduleRow = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
};

export function paymentSchedule(calculation: Calculation): ScheduleRow[] {
  if (calculation.months === 0 || calculation.financed <= 0) return [];
  if (calculation.method === "annuity") return annuityRows(calculation);
  if (calculation.method === "differentiated") return differentiatedRows(calculation);
  return equalRows(calculation);
}

/** Схема застройщика и наценка: платежи равные, наценка делится поровну. */
function equalRows({ financed, months, extra }: Calculation): ScheduleRow[] {
  const principal = financed / months;
  const interest = extra / months;
  return Array.from({ length: months }, (_, index) => ({
    month: index + 1,
    payment: principal + interest,
    principal,
    interest,
    balance: Math.max(0, financed - principal * (index + 1)),
  }));
}

function annuityRows({ financed, months, firstPayment, ratePct }: Calculation): ScheduleRow[] {
  const rate = monthlyRate(ratePct ?? 0);
  let balance = financed;
  return Array.from({ length: months }, (_, index) => {
    const interest = balance * rate;
    const principal = firstPayment - interest;
    balance -= principal;
    return {
      month: index + 1,
      payment: firstPayment,
      principal,
      interest,
      balance: Math.max(0, balance),
    };
  });
}

function differentiatedRows({ financed, months, ratePct }: Calculation): ScheduleRow[] {
  const rate = monthlyRate(ratePct ?? 0);
  const principal = financed / months;
  let balance = financed;
  return Array.from({ length: months }, (_, index) => {
    const interest = balance * rate;
    balance -= principal;
    return {
      month: index + 1,
      payment: principal + interest,
      principal,
      interest,
      balance: Math.max(0, balance),
    };
  });
}

/** Платежи к выводу: каждый округлён шагом валюты, последний = округлённый итог − остальные. */
export function roundedSchedule(rows: readonly ScheduleRow[], currency: Currency): ScheduleRow[] {
  if (rows.length === 0) return [];
  const total = roundMoney(
    rows.reduce((sum, row) => sum + row.payment, 0),
    currency,
  );
  const head = rows
    .slice(0, -1)
    .map((row) => ({ ...row, payment: roundMoney(row.payment, currency) }));
  const paid = head.reduce((sum, row) => sum + row.payment, 0);
  const last = rows.at(-1)!;
  const lastPayment = total - paid;
  if (lastPayment > 0 && Math.abs(lastPayment - last.payment) <= last.payment / 2) {
    return [...head, { ...last, payment: lastPayment }];
  }
  return cumulativeRounding(rows, currency);
}

/**
 * Запасной путь: ошибки округления голов (до полшага на строку) за сотни месяцев больше самого
 * платежа. Тогда платёж — разность округлённых нарастающих сумм: каждый в пределах шага.
 */
function cumulativeRounding(rows: readonly ScheduleRow[], currency: Currency): ScheduleRow[] {
  let exact = 0;
  let shown = 0;
  return rows.map((row) => {
    exact += row.payment;
    const next = roundMoney(exact, currency);
    const payment = next - shown;
    shown = next;
    return { ...row, payment };
  });
}

/**
 * График к выводу (В8 B) в валюте итога (переключатель $ | сум): строки пересчитаны по курсу, затем
 * округлены шагом этой валюты — последний платёж добирает разницу. Курса нет — в валюте расчёта.
 */
export function scheduleIn(
  calc: Calculation,
  out: Currency,
  rate: ExchangeRate | null,
): { rows: ScheduleRow[]; currency: Currency } {
  const rows = paymentSchedule(calc);
  const factor = out === calc.currency ? 1 : convertMoney(1, calc.currency, out, rate);
  if (factor === null || factor === 1) {
    return { rows: roundedSchedule(rows, calc.currency), currency: calc.currency };
  }
  const converted = rows.map((row) => ({
    ...row,
    payment: row.payment * factor,
    principal: row.principal * factor,
    interest: row.interest * factor,
    balance: row.balance * factor,
  }));
  return { rows: roundedSchedule(converted, out), currency: out };
}

/** Строка «Всего»: суммы платежей, долга и процентов; остатка у неё нет. */
export function scheduleTotals(rows: readonly ScheduleRow[]) {
  return rows.reduce(
    (sum, row) => ({
      payment: sum.payment + row.payment,
      principal: sum.principal + row.principal,
      interest: sum.interest + row.interest,
    }),
    { payment: 0, principal: 0, interest: 0 },
  );
}
