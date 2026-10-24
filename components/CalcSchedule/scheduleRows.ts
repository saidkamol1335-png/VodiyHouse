import type { Calculation } from "@/lib/calc/calculate";
import { type Currency, convertMoney, type ExchangeRate } from "@/lib/calc/money";
import { paymentSchedule, roundedSchedule, type ScheduleRow } from "@/lib/calc/schedule";

// График к выводу (В8 B): в валюте итога (переключатель $ | сум), платежи округлены шагом валюты,
// последний добирает разницу (lib/calc/schedule); колонки — по методу программы.

export type ScheduleColumn = "payment" | "principal" | "interest" | "balance";

/** У схемы — платёж и остаток; у наценки — ещё наценка; у банка — долг и проценты. */
export function scheduleColumns(calc: Calculation): ScheduleColumn[] {
  if (calc.method === "tiers") return ["payment", "balance"];
  if (calc.method === "markup") return ["payment", "interest", "balance"];
  return ["payment", "principal", "interest", "balance"];
}

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
