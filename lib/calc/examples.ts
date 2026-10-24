import type { CalcProgram, ProgramKind } from "./programs";
import type { ProgramOption } from "./options";
import { EMPTY_CALC_PARAMS, writeCalcParams } from "./params";

// «Примеры расчёта» на /kalkulyator (решение фазы 2: «Примеры из ТЗ» → «Примеры расчёта», только
// при DEMO): 120 м² × $700 · Ipoteka Bank · 20 % · 24 мес. и 145 м² × $980 · Ipak Yuli Bank
// · 25 % · 36 мес. — числа мокапа SiteCalc1 и SiteCalc2. Ссылка — обычный адрес расчёта.

export type CalcExample = {
  developer: string;
  bank: string;
  kind: ProgramKind;
  areaM2: number;
  perM2: number;
  downPct: number;
  months: number;
};

export const CALC_EXAMPLES: readonly CalcExample[] = [
  {
    developer: "demo-sifat",
    bank: "Ipoteka Bank",
    kind: "bank",
    areaM2: 120,
    perM2: 700,
    downPct: 20,
    months: 24,
  },
  {
    developer: "demo-margilan-invest",
    bank: "Ipak Yuli Bank",
    kind: "bank",
    areaM2: 145,
    perM2: 980,
    downPct: 25,
    months: 36,
  },
];

/** Адрес примера по программам застройщика; программы такой нет (не DEMO) — null. */
export function exampleSearch(
  example: CalcExample,
  options: readonly ProgramOption<CalcProgram>[],
): string | null {
  const option = options.find(
    (item) => item.kind === example.kind && item.bankName?.ru === example.bank,
  );
  if (!option) return null;
  return writeCalcParams({
    ...EMPTY_CALC_PARAMS,
    developer: example.developer,
    program: option.id,
    mode: "area",
    area: String(example.areaM2),
    perM2: String(example.perM2),
    downPct: example.downPct,
    months: example.months,
    inCurrency: "USD",
  }).toString();
}

/** Срок в подписи примера — годами, как в мокапе: «120 м² · 2 года». */
export const exampleYears = (example: CalcExample) => example.months / 12;
