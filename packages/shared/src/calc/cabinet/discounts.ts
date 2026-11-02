import { type CalcInput, type CalcResult, type ProgramPricing, calculate } from "../calculate";
import { comparePrograms } from "../compare";
import type { TieredProgram, DownTier, FullPaymentProgram, TermsProgram } from "../programs";

// Скидки — только в кабинете (PLAN §3.13, §3б): «Расчёт для клиента» со скидкой за взнос и за
// 100 % оплату. Сайт этот модуль не импортирует — проверяет discounts.test.ts.

export type DiscountedTier = DownTier & { discountPct: number };
export type CabinetTieredProgram = Omit<TieredProgram, "tiers"> & {
  tiers: readonly DiscountedTier[];
};
/** Скидка за 100 % — одно место: у программы «100% оплата» (решение фазы 2). */
export type CabinetFullProgram = FullPaymentProgram & { discountPct: number };
export type CabinetProgram = CabinetFullProgram | CabinetTieredProgram | TermsProgram;

/** Скидка программы при выбранной ступени, %. */
export function discountPctOf(program: CabinetProgram, tierIndex: number | null): number {
  if (program.type === "full") return program.discountPct;
  if (program.method !== "tiers") return 0;
  return tierIndex === null ? 0 : (program.tiers[tierIndex]?.discountPct ?? 0);
}

const pricingOf =
  (program: CabinetProgram): ProgramPricing =>
  ({ price, tierIndex }) =>
    price * (1 - discountPctOf(program, tierIndex) / 100);

export function calculateWithDiscount(program: CabinetProgram, input: CalcInput): CalcResult {
  return calculate(program, input, pricingOf(program));
}

export function compareWithDiscount<P extends CabinetProgram>(
  programs: readonly P[],
  input: CalcInput,
) {
  return comparePrograms(programs, input, pricingOf);
}

/** Карточка варианта схемы (Р1): «50% → −6% · до 18 мес.»; у 100 % срока нет. */
export type SchemeOption = { downPct: number; discountPct: number; maxMonths: number | null };

export function schemeOptions(
  program: CabinetTieredProgram,
  full: CabinetFullProgram | null,
): SchemeOption[] {
  const options: SchemeOption[] = program.tiers.map((tier) => ({
    downPct: tier.minDownPct,
    discountPct: tier.discountPct,
    maxMonths: tier.maxMonths,
  }));
  return full
    ? [...options, { downPct: 100, discountPct: full.discountPct, maxMonths: null }]
    : options;
}

/** Скидка в деньгах: цена по прайсу минус цена по программе; без скидки — 0. */
export function discountAmount(calculation: { price: number; programPrice: number }): number {
  return Math.max(0, calculation.price - calculation.programPrice);
}
