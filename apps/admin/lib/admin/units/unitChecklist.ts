import { unitPricePerM2, unitTotalPrice } from "@vh/shared/calc/unitPrice";
import { parsePriceInput } from "@vh/shared/format";
import type { UnitRecord } from "@vh/shared/units";
import type { UnitsLayout } from "./types";
import type { UnitDraft } from "./unitForm";

// Чек-лист квартиры (экран 5, PLAN §10 п. 27) по правилу публикации v2: на сайте с ценой —
// планировка с чертежом от 1200 px, комнатами и площадью, своя цена и статус «в продаже».

export const UNIT_CHECKLIST = ["layout", "drawing", "roomsArea", "price", "free"] as const;
export type UnitChecklistKey = (typeof UNIT_CHECKLIST)[number];

/** Цена черновика формы: null — без цены или ввод не разобрать. */
function draftPrice(draft: UnitDraft): { price: number | null; pricePerM2: number | null } {
  if (draft.price.mode === "none") return { price: null, pricePerM2: null };
  const { value } = parsePriceInput(draft.price.raw);
  return draft.price.mode === "total"
    ? { price: value, pricePerM2: null }
    : { price: null, pricePerM2: value };
}

export function unitChecklist(
  unit: UnitRecord,
  draft: UnitDraft,
  layout: UnitsLayout | null,
): { key: UnitChecklistKey; ok: boolean }[] {
  const price = draftPrice(draft);
  const ok: Record<UnitChecklistKey, boolean> = {
    layout: layout !== null,
    drawing: layout !== null && !layout.drawingMissing,
    roomsArea: layout !== null && layout.area > 0,
    price: price.price !== null || price.pricePerM2 !== null,
    free: unit.status === "free",
  };
  return UNIT_CHECKLIST.map((key) => ({ key, ok: ok[key] }));
}

/** Цена карточки превью — целиком и за м², как на сайте. */
export function unitPreview(draft: UnitDraft, layout: UnitsLayout | null) {
  const price = draftPrice(draft);
  const area = layout?.area ?? null;
  return { total: unitTotalPrice(price, area), perM2: unitPricePerM2(price, area) };
}
