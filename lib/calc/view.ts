import type { CalcInput, CalcResult } from "./calculate";
import { type Currency, type ExchangeRate } from "./money";
import type { CalcEngine, Comparison, DownOption, ProgramOption } from "./options";
import { appliesToBlock } from "./options";
import type { CalcParams } from "./params";
import { type ResolvedPrice, resolvePrice, type CalcStock } from "./priceSource";
import { type CalcProgram, DOWN_MAX_PCT, minDownOf } from "./programs";
import { allowsCustomMonths, termButtons } from "./terms";

// Состояние калькулятора из данных и адреса (кабинет, /kalkulyator, расчёт квартиры): какая
// программа, взнос и срок, результат и сравнение. Чистая функция — интерфейс только показывает.

export type CalcData<P extends CalcProgram> = {
  options: readonly ProgramOption<P>[];
  stock: CalcStock;
  rate: ExchangeRate | null;
};

export type CalcView<P extends CalcProgram> = {
  price: ResolvedPrice;
  /** Программы, которые действуют для выбранной стоимости (блок квартиры). */
  options: ProgramOption<P>[];
  selected: ProgramOption<P> | null;
  downPct: number;
  minDownPct: number;
  downOptions: DownOption[];
  termButtons: number[];
  customMonths: boolean;
  requestedMonths: number | null;
  input: CalcInput | null;
  result: CalcResult | null;
  comparison: Comparison<P> | null;
  outCurrency: Currency;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Программа по умолчанию — рассрочка застройщика (мокап), иначе первая. */
function pickProgram<P extends CalcProgram>(
  options: readonly ProgramOption<P>[],
  id: string | null,
) {
  return (
    options.find((option) => option.id === id) ??
    options.find((option) => option.kind === "scheme") ??
    options[0] ??
    null
  );
}

function downOf(program: CalcProgram, requested: number | null) {
  const min = minDownOf(program);
  if (program.type === "full") return { min, down: 100 };
  return { min, down: clamp(requested ?? min, min, DOWN_MAX_PCT) };
}

export function calculatorView<P extends CalcProgram>(
  engine: CalcEngine<P>,
  data: CalcData<P>,
  params: CalcParams,
  allowUnits: boolean,
): CalcView<P> {
  const price = resolvePrice(data.stock, params, allowUnits);
  const options = data.options.filter((option) => appliesToBlock(option, price.blockId));
  const selected = pickProgram(options, params.program);
  const { min, down } = selected ? downOf(selected.program, params.downPct) : { min: 0, down: 0 };
  const input: CalcInput | null =
    price.price === null
      ? null
      : {
          price: price.price,
          priceCurrency: price.currency,
          downPct: down,
          months: params.months,
          rate: data.rate,
        };
  const result = selected && input ? engine.calculate(selected.program, input) : null;
  const calcCurrency = result?.ok ? result.calculation.currency : price.currency;
  return {
    price,
    options,
    selected,
    downPct: down,
    minDownPct: min,
    downOptions: selected ? engine.downOptions(selected, options) : [],
    termButtons: selected ? termButtons(selected.program, down) : [],
    customMonths: selected ? allowsCustomMonths(selected.program) : false,
    requestedMonths: params.months,
    input,
    result,
    comparison: input
      ? engine.compare(
          options.map((option) => option.program),
          input,
        )
      : null,
    // Нет курса — итог только в валюте расчёта.
    outCurrency: data.rate ? (params.outCurrency ?? calcCurrency) : calcCurrency,
  };
}
