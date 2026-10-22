// Цена квартиры в формах кабинета (Н3): режим «за м² | за квартиру | без цены» и сумма, как её
// набрали. Разбор — parsePriceInput (lib/format), пример расчёта — lib/calc: деньги считаются
// только там (CLAUDE.md §1).

import { unitTotalPrice } from "@/lib/calc/unitPrice";
import {
  PRICE_MAX,
  PRICE_PER_M2_MAX,
  formatAmount,
  formatPrice,
  parsePriceInput,
} from "@/lib/format";
import type { UnitFieldsPatch, UnitRecord } from "@/lib/units";
import type { PriceChange, PriceMode, UnitsBlock } from "./types";

export type PriceDraft = { mode: PriceMode; raw: string };
export type PriceIssue = "required" | "notNumber" | "outOfRange";

export function priceModeOf(unit: UnitRecord): PriceMode {
  if (unit.pricePerM2 !== null) return "per_m2";
  return unit.price !== null ? "total" : "none";
}

/**
 * Режим по умолчанию для массовой цены: общий у выбранных, если он «за м²» или «за квартиру»;
 * иначе «за м²» — «без цены» по умолчанию ничего бы не сделал, а снятие цены — осознанный выбор.
 */
export function defaultPriceMode(units: readonly UnitRecord[]): Exclude<PriceMode, "none"> {
  const modes = new Set(units.map(priceModeOf));
  const [only] = [...modes];
  return modes.size === 1 && only === "total" ? "total" : "per_m2";
}

/** Предел суммы: за м² — свой (как в базе), за квартиру — общий предел цены. */
export const priceMax = (mode: PriceMode) => (mode === "per_m2" ? PRICE_PER_M2_MAX : PRICE_MAX);

/** Черновик → цена для действия или что не так с суммой. */
export function readPriceDraft(draft: PriceDraft): PriceChange | { issue: PriceIssue } {
  if (draft.mode === "none") return { mode: "none", value: null };
  const parsed = parsePriceInput(draft.raw, priceMax(draft.mode));
  if (parsed.issue) return { issue: parsed.issue };
  if (parsed.value === null) return { issue: "required" };
  return { mode: draft.mode, value: parsed.value };
}

export const isPriceIssue = (
  value: PriceChange | { issue: PriceIssue },
): value is { issue: PriceIssue } => "issue" in value;

/** Поля квартиры после цены — как их запишет база (одна из двух колонок или ни одной). */
export function priceFields(change: PriceChange): UnitFieldsPatch {
  return {
    price: change.mode === "total" ? change.value : null,
    pricePerM2: change.mode === "per_m2" ? change.value : null,
  };
}

/**
 * Пример «64,5 м² × 620 = $39 990» для цены за м²: множитель — как набрали (с разрядами, без
 * округления до тысячи сумов), итог — formatPrice. null — не посчитать (нет площади).
 */
export function priceExample(
  area: number | null,
  perM2: number,
  currency: UnitsBlock["currency"],
): { perM2: string; total: string } | null {
  const total = unitTotalPrice({ price: null, pricePerM2: perM2 }, area);
  if (total === null) return null;
  return { perM2: formatAmount(perM2), total: formatPrice(total, currency) };
}

export const withoutLayoutCount = (units: readonly UnitRecord[]) =>
  units.filter((unit) => unit.layoutId === null).length;
