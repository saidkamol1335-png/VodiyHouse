import { type CalcInput, type Calculation, type ProgramPricing, calculate } from "./calculate";
import { type Currency, type ExchangeRate, convertMoney, roundMoney } from "./money";
import { type CalcProgram, isTermsProgram, isTiered, maxMonthsOf, minDownOf } from "./programs";

// Сравнение программ застройщика и «Платёж от» карточки ЖК — по правилам мокапа.

export type ComparisonRow<P extends CalcProgram> = {
  program: P;
  calculation: Calculation;
  /** «Выгоднее всего» — наименьший итог (у всех, кто вровень). */
  cheapest: boolean;
  /** «Меньше платёж» — наименьший первый платёж среди программ с платежами. */
  lowestPayment: boolean;
};

/** Срок для сравнения: у строк — тот же, если он есть, иначе самый длинный; у схемы — по её правилам. */
function comparedMonths(program: CalcProgram, months: number | null): number | null {
  if (!isTermsProgram(program)) return months;
  return program.terms.some((row) => row.months === months) ? months : null;
}

/** Сумма в валюте цены, округлённая шагом вывода, — чтобы равные итоги считались равными. */
function inPriceCurrency(amount: number, calculation: Calculation, input: CalcInput) {
  const converted = convertMoney(amount, calculation.currency, input.priceCurrency, input.rate);
  return converted === null ? null : roundMoney(converted, input.priceCurrency);
}

/**
 * Взнос — не ниже минимума программы (это делает calculate), срок — comparedMonths.
 * Программы, которые не посчитать (нет курса), — в unavailable.
 */
export function comparePrograms<P extends CalcProgram>(
  programs: readonly P[],
  input: CalcInput,
  pricingFor?: (program: P) => ProgramPricing | undefined,
): { rows: ComparisonRow<P>[]; unavailable: P[] } {
  const computed: { program: P; calculation: Calculation }[] = [];
  const unavailable: P[] = [];
  for (const program of programs) {
    const months = comparedMonths(program, input.months);
    // Срок другой программы (ипотека на 180 мес.) схеме не положен: в сравнении она считается на
    // своём максимуме, даже если сама предлагает «уточнить у застройщика» (lead).
    const compared = isTiered(program)
      ? { ...program, overMaxBehavior: "block" as const }
      : program;
    const result = calculate(compared, { ...input, months }, pricingFor?.(program));
    if (result.ok) computed.push({ program, calculation: result.calculation });
    else unavailable.push(program);
  }
  const totals = computed.map(({ calculation }) =>
    inPriceCurrency(calculation.total, calculation, input),
  );
  const payments = computed.map(({ calculation }) =>
    calculation.firstPayment > 0
      ? inPriceCurrency(calculation.firstPayment, calculation, input)
      : null,
  );
  const minTotal = minimum(totals);
  const minPayment = minimum(payments);
  const rows = computed.map((entry, index) => ({
    ...entry,
    cheapest: totals[index] !== null && totals[index] === minTotal,
    lowestPayment: payments[index] !== null && payments[index] === minPayment,
  }));
  return { rows, unavailable };
}

function minimum(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0 ? Math.min(...present) : null;
}

/**
 * «Платёж от … /мес» (ТЗ 6.2 по мокапу): рассрочка застройщика и через банк, минимальный взнос,
 * самый длинный срок, без скидок; в валюте цены. null — считать не из чего.
 */
export function paymentFrom(
  programs: readonly CalcProgram[],
  price: number,
  priceCurrency: Currency,
  rate: ExchangeRate | null,
): number | null {
  let best: number | null = null;
  for (const program of programs) {
    if (program.type !== "installment" && program.type !== "bank_installment") continue;
    const input = { price, priceCurrency, rate, downPct: minDownOf(program) };
    const result = calculate(program, { ...input, months: maxMonthsOf(program) });
    if (!result.ok) continue;
    const { firstPayment, currency } = result.calculation;
    const payment = convertMoney(firstPayment, currency, priceCurrency, rate);
    if (payment !== null && (best === null || payment < best)) best = payment;
  }
  return best;
}
