import { type CalcResult } from "./calculate";
import { calculateWithDiscount, type CabinetProgram } from "./cabinet/discounts";
import type { Currency, ExchangeRate } from "./money";
import { maxMonthsOf, minDownOf } from "./programs";

// «Пример: 60 м² × $620, взнос 30 %, 36 мес. → $723/мес» на карточке программы в кабинете
// (мокап CabProg): 60 м², цена м² — минимальная по свободным квартирам застройщика (Р8),
// округлённая до $10 или 10 000 сум, как в мокапе; взнос — минимальный, срок — самый длинный.

export const EXAMPLE_AREA_M2 = 60;
const PER_M2_STEP: Readonly<Record<Currency, number>> = { USD: 10, UZS: 10_000 };

export type ProgramExample = {
  areaM2: number;
  perM2: number;
  price: number;
  priceCurrency: Currency;
  result: CalcResult;
};

export function programExample(
  program: CabinetProgram,
  hint: { perM2: number; currency: Currency },
  rate: ExchangeRate | null,
): ProgramExample {
  const step = PER_M2_STEP[hint.currency];
  const perM2 = Math.max(step, Math.round(hint.perM2 / step) * step);
  const price = perM2 * EXAMPLE_AREA_M2;
  const input = {
    price,
    priceCurrency: hint.currency,
    downPct: minDownOf(program),
    months: program.type === "full" ? null : maxMonthsOf(program),
    rate,
  };
  return {
    areaM2: EXAMPLE_AREA_M2,
    perM2,
    price,
    priceCurrency: hint.currency,
    result: calculateWithDiscount(program, input),
  };
}
