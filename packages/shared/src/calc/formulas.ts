import type { FeeName, FeeRule } from "./programs";

// Формулы PLAN §7 фаза 2 и ТЗ 9.1 — без округления. S — сумма кредита (остаток), ставка годовая.

/** Месячная ставка из годовой, в долях. */
export const monthlyRate = (annualRatePct: number) => annualRatePct / 12 / 100;

/** Аннуитет: M = S × r / (1 − (1 + r)^−n); при ставке 0 — S / n. */
export function annuityPayment(financed: number, annualRatePct: number, months: number): number {
  const rate = monthlyRate(annualRatePct);
  if (rate === 0) return financed / months;
  return (financed * rate) / (1 - Math.pow(1 + rate, -months));
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
