import type { Calculation } from "@/lib/calc/calculate";

// Колонки графика (В8 B) по методу программы; сами строки в валюте итога и «Всего» —
// lib/calc/schedule (scheduleIn, scheduleTotals).

export type ScheduleColumn = "payment" | "principal" | "interest" | "balance";

/** У схемы — платёж и остаток; у наценки — ещё наценка; у банка — долг и проценты. */
export function scheduleColumns(calc: Calculation): ScheduleColumn[] {
  if (calc.method === "tiers") return ["payment", "balance"];
  if (calc.method === "markup") return ["payment", "interest", "balance"];
  return ["payment", "principal", "interest", "balance"];
}
