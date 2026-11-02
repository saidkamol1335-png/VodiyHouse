import type { Currency } from "./money";
import type { CalcParams, PriceMode } from "./params";
import type { BilingualRecord } from "./records";

// Стоимость для расчёта (Р7, Р8, решение экранов «Режим „Квартира“»): квартира из наличия,
// «цена от» планировки, площадь × цена м² (по умолчанию — 60 м² и минимальная цена м² свободных
// квартир застройщика), сумма. Валюта квартиры и планировки — валюта блока; ввода — выбор (Р7).

export type CalcBlock = {
  id: string;
  name: string;
  complexId: string;
  complexName: BilingualRecord;
  currency: Currency;
};

export type CalcLayout = {
  id: string;
  blockId: string;
  rooms: number;
  area: number;
  /** null — «цена по запросу»: строка недоступна (Р8). */
  priceFrom: number | null;
  available: boolean;
};

export type CalcUnit = {
  id: string;
  number: string;
  floor: number;
  blockId: string;
  layoutId: string | null;
  rooms: number | null;
  area: number | null;
  price: number | null;
};

export type CalcStock = {
  blocks: readonly CalcBlock[];
  layouts: readonly CalcLayout[];
  units: readonly CalcUnit[];
  /** Цена м² по умолчанию — как «Пример» на карточке программы. */
  priceHint: { perM2: number; currency: Currency } | null;
};

export type ResolvedPrice = {
  mode: PriceMode;
  price: number | null;
  currency: Currency;
  /** Блок квартиры или планировки — по нему выбираются программы; null — любой. */
  blockId: string | null;
  unitId: string | null;
  layoutId: string | null;
  areaM2: number | null;
  perM2: number | null;
};

export const DEFAULT_AREA_M2 = 60;
const PER_M2_STEP: Readonly<Record<Currency, number>> = { USD: 10, UZS: 10_000 };

/** «64,2», «8 500 000», «700.5» → число; пусто и чужое — null. */
export function parseAmountText(raw: string | null): number | null {
  if (raw === null) return null;
  const text = raw.replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return value > 0 ? value : null;
}

/** Цена м² по умолчанию: подсказка застройщика, округлённая до $10 или 10 000 сум (мокап). */
export function defaultPerM2(hint: CalcStock["priceHint"]): number | null {
  if (!hint) return null;
  const step = PER_M2_STEP[hint.currency];
  return Math.max(step, Math.round(hint.perM2 / step) * step);
}

const priced = <T extends { price?: number | null; priceFrom?: number | null }>(item: T) =>
  (item.price ?? item.priceFrom ?? 0) > 0;

/**
 * Режим по умолчанию из разрешённых экраном: есть свободные квартиры с ценой — «Квартира», иначе
 * площадь × цена м², а у расчёта квартиры (один режим) — он сам.
 */
export function defaultMode(stock: CalcStock, modes: readonly PriceMode[]): PriceMode {
  if (modes.includes("unit") && stock.units.some(priced)) return "unit";
  if (modes.includes("area")) return "area";
  return modes[0] ?? "area";
}

/** Блок подходит программе из адреса: квартира и планировка по умолчанию — из такого блока. */
export type BlockFit = (blockId: string) => boolean;

const ANY_BLOCK: BlockFit = () => true;

function unitPrice(stock: CalcStock, params: CalcParams, fits: BlockFit): ResolvedPrice {
  const unit =
    stock.units.find((item) => item.id === params.unit && priced(item)) ??
    stock.units.find((item) => priced(item) && fits(item.blockId)) ??
    stock.units.find(priced);
  const block = stock.blocks.find((item) => item.id === unit?.blockId);
  const price = unit?.price ?? null;
  return {
    ...empty("unit", block?.currency ?? "USD"),
    price,
    blockId: unit?.blockId ?? null,
    unitId: unit?.id ?? null,
    areaM2: unit?.area ?? null,
    perM2: price !== null && unit?.area ? price / unit.area : null,
  };
}

function layoutPrice(stock: CalcStock, params: CalcParams, fits: BlockFit): ResolvedPrice {
  const choosable = (item: CalcLayout) => item.available && priced(item);
  const layout =
    stock.layouts.find((item) => item.id === params.layout && choosable(item)) ??
    stock.layouts.find((item) => choosable(item) && fits(item.blockId)) ??
    stock.layouts.find(choosable);
  const block = stock.blocks.find((item) => item.id === layout?.blockId);
  return {
    ...empty("layout", block?.currency ?? "USD"),
    price: layout?.priceFrom ?? null,
    blockId: layout?.blockId ?? null,
    layoutId: layout?.id ?? null,
    areaM2: layout?.area ?? null,
    perM2: layout?.priceFrom ? layout.priceFrom / layout.area : null,
  };
}

function empty(mode: PriceMode, currency: Currency): ResolvedPrice {
  return {
    mode,
    price: null,
    currency,
    blockId: null,
    unitId: null,
    layoutId: null,
    areaM2: null,
    perM2: null,
  };
}

/** Валюта, общая для всех блоков застройщика (Р7 B); блоки в разных валютах или их нет — null. */
function blocksCurrency(stock: CalcStock): Currency | null {
  const first = stock.blocks[0]?.currency ?? null;
  return stock.blocks.every((block) => block.currency === first) ? first : null;
}

/**
 * Стоимость по режиму из адреса; режима нет или экран его не разрешает (?mode=sum у расчёта
 * квартиры) — режим по умолчанию.
 */
export function resolvePrice(
  stock: CalcStock,
  params: CalcParams,
  modes: readonly PriceMode[],
  fits: BlockFit = ANY_BLOCK,
): ResolvedPrice {
  const mode = params.mode !== null && modes.includes(params.mode) ? params.mode : null;
  const chosen = mode ?? defaultMode(stock, modes);
  if (chosen === "unit") return unitPrice(stock, params, fits);
  if (chosen === "layout") return layoutPrice(stock, params, fits);
  const currency = params.inCurrency ?? stock.priceHint?.currency ?? blocksCurrency(stock) ?? "USD";
  if (chosen === "sum") return { ...empty("sum", currency), price: parseAmountText(params.sum) };
  // Площадь × цена м²: по умолчанию — 60 м² и цена м² подсказки (в её валюте; валюту сменили —
  // поле пустое). Набранное, но пустое или чужое — не подменяем: «Введите стоимость».
  const sameCurrency = currency === (stock.priceHint?.currency ?? currency);
  const areaM2 = params.area === null ? DEFAULT_AREA_M2 : parseAmountText(params.area);
  const perM2 =
    params.perM2 === null
      ? sameCurrency
        ? defaultPerM2(stock.priceHint)
        : null
      : parseAmountText(params.perM2);
  return {
    ...empty("area", currency),
    price: perM2 === null || areaM2 === null ? null : areaM2 * perM2,
    areaM2,
    perM2,
  };
}
