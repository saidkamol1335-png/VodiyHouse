// Правка строки руководителем (Н4): номер, планировка, цена, отделка. В патч уходят только поля,
// которые трогали: список мог перечитаться, пока форма открыта, и «нетронутое» старое значение
// затёрло бы чужую правку. Тронутое сравнивается со свежей строкой: вернуть цену или планировку,
// которую тем временем поменяли массово или стояками, — тоже правка.

import { formatAmount } from "@/lib/format";
import { foldUnitNumber, isUnitNumber, normalizeUnitNumber, type UnitRecord } from "@/lib/units";
import {
  isPriceIssue,
  priceModeOf,
  readPriceDraft,
  type PriceDraft,
  type PriceIssue,
} from "./priceForm";
import type { UnitPatch } from "./types";

export type DraftField = "number" | "layoutId" | "price" | "finishingId";

export type UnitDraft = {
  number: string;
  /** "" — без планировки. */
  layoutId: string;
  price: PriceDraft;
  /** "" — как в блоке. */
  finishingId: string;
  /** Что трогали. Нетронутая дробная цена из базы к тому же не проходит разбор ввода. */
  touched: Readonly<Record<DraftField, boolean>>;
};

const UNTOUCHED = { number: false, layoutId: false, price: false, finishingId: false };

export function draftFromUnit(unit: UnitRecord): UnitDraft {
  const amount = unit.pricePerM2 ?? unit.price;
  return {
    number: unit.number,
    layoutId: unit.layoutId ?? "",
    price: { mode: priceModeOf(unit), raw: amount === null ? "" : formatAmount(amount) },
    finishingId: unit.finishingId === null ? "" : String(unit.finishingId),
    touched: UNTOUCHED,
  };
}

/** Поле поменяли в форме: новое значение и отметка «трогали». */
export function withField<K extends DraftField>(
  draft: UnitDraft,
  field: K,
  value: UnitDraft[K],
): UnitDraft {
  return { ...draft, [field]: value, touched: { ...draft.touched, [field]: true } };
}

/** Значения не как при открытии формы (отметки «трогали» не в счёт). */
export const draftChanged = (draft: UnitDraft, start: UnitDraft) =>
  draft.number !== start.number ||
  draft.layoutId !== start.layoutId ||
  draft.finishingId !== start.finishingId ||
  draft.price.mode !== start.price.mode ||
  draft.price.raw !== start.price.raw;

export type UnitDraftIssues = { number?: "invalid" | "taken"; price?: PriceIssue };

export type UnitDraftCheck = {
  /** null — менять нечего. */
  patch: UnitPatch | null;
  issues: UnitDraftIssues;
  /** Другая квартира с тем же номером в другой раскладке (12А / 12A) — предупредить. */
  twin: string | null;
};

function numberPart(current: UnitRecord, draft: UnitDraft, units: readonly UnitRecord[]) {
  const number = normalizeUnitNumber(draft.number);
  if (!draft.touched.number || number === current.number)
    return { patch: {}, issue: undefined, twin: null };
  if (!isUnitNumber(number)) return { patch: {}, issue: "invalid" as const, twin: null };
  const others = units.filter((unit) => unit.id !== current.id);
  if (others.some((unit) => unit.number === number))
    return { patch: {}, issue: "taken" as const, twin: null };
  const twin = others.find((unit) => foldUnitNumber(unit.number) === foldUnitNumber(number));
  return { patch: { number }, issue: undefined, twin: twin?.number ?? null };
}

function pricePart(
  current: UnitRecord,
  draft: UnitDraft,
): { patch: UnitPatch; issue?: PriceIssue } {
  if (!draft.touched.price) return { patch: {} };
  const change = readPriceDraft(draft.price);
  if (isPriceIssue(change)) return { patch: {}, issue: change.issue };
  const sameMode = change.mode === priceModeOf(current);
  const sameValue = change.value === (current.pricePerM2 ?? current.price);
  return sameMode && sameValue ? { patch: {} } : { patch: { price: change } };
}

/** Выбор из списка: тронутый и не как в свежей строке — в патч. */
function pickPart<K extends "layoutId" | "finishingId">(
  key: K,
  value: UnitRecord[K],
  current: UnitRecord,
  touched: boolean,
): UnitPatch {
  return touched && value !== current[key] ? { [key]: value } : {};
}

/**
 * Что отправить и что не так; номер-дубль ловится здесь, без запроса (база проверит ещё раз).
 * Свежая строка — из units по id; квартиры там уже нет — сравнение со снимком.
 */
export function checkUnitDraft(
  initial: UnitRecord,
  draft: UnitDraft,
  units: readonly UnitRecord[],
): UnitDraftCheck {
  const current = units.find((unit) => unit.id === initial.id) ?? initial;
  const number = numberPart(current, draft, units);
  const price = pricePart(current, draft);
  const finishingId = draft.finishingId ? Number(draft.finishingId) : null;
  const { touched } = draft;
  const patch: UnitPatch = {
    ...number.patch,
    ...pickPart("layoutId", draft.layoutId || null, current, touched.layoutId),
    ...price.patch,
    ...pickPart("finishingId", finishingId, current, touched.finishingId),
  };
  const issues: UnitDraftIssues = {};
  if (number.issue) issues.number = number.issue;
  if (price.issue) issues.price = price.issue;
  return { patch: Object.keys(patch).length > 0 ? patch : null, issues, twin: number.twin };
}
