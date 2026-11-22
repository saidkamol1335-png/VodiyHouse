import type { FeeName, FeeRule } from "./programs";

// Формулы PLAN §7 фаза 2 и ТЗ 9.1 — без округления. S — сумма кредита (остаток), ставка годовая.

/** Месячная ставка из годовой, в долях; порядок деления — как у uysot.uz (float до последнего знака, 22.11). */
export const monthlyRate = (annualRatePct: number) => annualRatePct / 100 / 12;

/**
 * Аннуитет: M = r·(1 + r)^n·S / ((1 + r)^n − 1); при ставке 0 — S / n. Запись и порядок действий —
 * как у uysot.uz/mortgage-calculator: риелторский калькулятор совпадает с ним до сума (22.11).
 */
export function annuityPayment(financed: number, annualRatePct: number, months: number): number {
  const rate = monthlyRate(annualRatePct);
  if (rate === 0) return financed / months;
  const growth = Math.pow(1 + rate, months);
  return (rate * growth * financed) / (growth - 1);
}

/** Дифференцированный: платёж_i = S / n + остаток_i × r; проценты = S × r × (n + 1) / 2. */
export function differentiatedPayments(financed: number, annualRatePct: number, months: number) {
  const rate = monthlyRate(annualRatePct);
  const principal = financed / months;
  return {
    first: principal + financed * rate,
    last: principal * (1 + rate),
    interest: (financed * rate * (months + 1)) / 2,
  };
}

export type FeeAmount = { name: FeeName; amount: number };

/** Разовые платежи: fixed — как есть, pct — % от суммы кредита (PLAN §7). */
export function feeAmounts(fees: readonly FeeRule[], financed: number): FeeAmount[] {
  return fees.map((fee) => ({
    name: fee.name,
    amount: fee.kind === "pct" ? (financed * fee.value) / 100 : fee.value,
  }));
}
