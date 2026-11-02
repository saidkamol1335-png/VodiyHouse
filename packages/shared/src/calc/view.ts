import type { CalcInput, CalcResult } from "./calculate";
import { type Currency, type ExchangeRate } from "./money";
import type { CalcEngine, Comparison, DownOption, ProgramOption } from "./options";
import { appliesToBlock } from "./options";
import type { CalcParams, PriceMode } from "./params";
import { type ResolvedPrice, resolvePrice, type CalcStock } from "./priceSource";
import { type CalcProgram, DOWN_MAX_PCT, minDownOf } from "./programs";
import { allowsCustomMonths, termButtons } from "./terms";

// Состояние калькулятора из данных и адреса (кабинет, /kalkulyator, расчёт квартиры): какая
// программа, взнос и срок, результат и сравнение. Чистая функция — интерфейс только показывает.

export type CalcData<P extends CalcProgram> = {
  options: readonly ProgramOption<P>[];
  stock: CalcStock;
  rate: ExchangeRate | null;
  /** Сайт: курса нет, и программы банков в чужой валюте убраны (lib/calc/siteOptions). */
  hiddenForRate?: boolean;
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

/**
 * Сравнение — на сроке выбранной программы (мокап: тот же срок, если он есть у программы, иначе её
 * самый длинный), а не на сроке «по умолчанию»: иначе строки посчитаны на разных сроках.
 */
function compareOn<P extends CalcProgram>(
  engine: CalcEngine<P>,
  options: readonly ProgramOption<P>[],
  input: CalcInput,
  result: CalcResult | null,
) {
  const applied = result?.ok && result.calculation.months > 0 ? result.calculation.months : null;
  const programs = options.map((option) => option.program);
  return engine.compare(programs, { ...input, months: applied ?? input.months });
}

export function calculatorView<P extends CalcProgram>(
  engine: CalcEngine<P>,
  data: CalcData<P>,
  params: CalcParams,
  modes: readonly PriceMode[],
): CalcView<P> {
  const price = resolvePrice(data.stock, params, modes);
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
    comparison: input ? compareOn(engine, options, input, result) : null,
    // Нет курса — итог только в валюте расчёта.
    outCurrency: data.rate ? (params.outCurrency ?? calcCurrency) : calcCurrency,
  };
}

/** Где искать стоимость для программы из адреса, если режима в адресе нет. */
const PIN_ORDER: readonly PriceMode[] = ["unit", "layout", "area"];

/**
 * Начальные параметры: программа пришла из адреса («Рассчитать» у программы блока B в кабинете), а
 * стоимость по умолчанию — из блока, где она не действует (первая свободная квартира в блоке A,
 * проданная квартира из старой ссылки). Тогда берём квартиру, планировку или площадь, к которым
 * программа подходит, и закрепляем в адресе: иначе расчёт молча взял бы другую программу, а смена
 * программы потом меняла бы квартиру. Квартиру (планировку), выбранную в адресе и свободную, не трогаем.
 */
export function pinProgramBlock<P extends CalcProgram>(
  data: CalcData<P>,
  params: CalcParams,
  modes: readonly PriceMode[],
): CalcParams {
  const wanted = data.options.find((option) => option.id === params.program);
  if (!wanted) return params;
  const fits = (blockId: string | null) => appliesToBlock(wanted, blockId);
  const current = resolvePrice(data.stock, params, modes);
  const chosen =
    (params.unit !== null && current.unitId === params.unit) ||
    (params.layout !== null && current.layoutId === params.layout);
  if (chosen || fits(current.blockId)) return params;
  const order = params.mode ? [params.mode] : PIN_ORDER.filter((mode) => modes.includes(mode));
  for (const mode of order) {
    const pinned = { ...params, mode, unit: null, layout: null };
    const price = resolvePrice(data.stock, pinned, modes, fits);
    // Квартира и планировка должны найтись; у площади и суммы блока нет — подходит любая программа.
    const found = price.blockId !== null || mode === "area" || mode === "sum";
    if (found && fits(price.blockId))
      return { ...pinned, unit: price.unitId, layout: price.layoutId };
  }
  return params;
}

const amountText = (value: number | null) => (value === null ? null : String(value));

/**
 * Параметры, которые воспроизводят расчёт на экране, — для ссылки «Расчёт: …» в Telegram. Выбранное
 * по умолчанию (программа, 60 м² × цена м², срок) пишется явно: ссылка не зависит от того, что
 * сервер выберет по умолчанию завтра (продали квартиру, опубликовали застройщика).
 */
export function shareParams<P extends CalcProgram>(
  view: CalcView<P>,
  params: CalcParams,
): CalcParams {
  const { price } = view;
  const calc = view.result?.ok ? view.result.calculation : null;
  const typed = price.mode === "area" || price.mode === "sum";
  return {
    ...params,
    program: view.selected?.id ?? params.program,
    mode: price.mode,
    unit: price.mode === "unit" ? price.unitId : null,
    layout: price.mode === "layout" ? price.layoutId : null,
    area: price.mode === "area" ? amountText(price.areaM2) : null,
    perM2: price.mode === "area" ? amountText(price.perM2) : null,
    sum: price.mode === "sum" ? params.sum : null,
    inCurrency: typed ? price.currency : null,
    downPct: view.selected && view.selected.program.type !== "full" ? view.downPct : null,
    months: calc && calc.months > 0 ? calc.months : null,
    outCurrency: view.outCurrency,
  };
}
