import type { UnitRecord } from "@vh/shared/units";
import type { UnitsLayout } from "./types";

// «На сайте» у квартиры (экран 4, правило публикации v2): видна с ценой, если у неё есть планировка,
// своя цена и у планировки — чертёж от 1200 px. Статус не мешает: бронь и продажа видны на фасаде.

export type UnitSiteGap = "layout" | "price" | "drawing";

export function unitSiteGaps(unit: UnitRecord, layouts: ReadonlyMap<string, UnitsLayout>): UnitSiteGap[] {
  const layout = unit.layoutId ? layouts.get(unit.layoutId) : undefined;
  return [
    ...(layout ? [] : (["layout"] as const)),
    ...(unit.price === null && unit.pricePerM2 === null ? (["price"] as const) : []),
    ...(layout?.drawingMissing ? (["drawing"] as const) : []),
  ];
}

/** id квартир, которых на сайте нет с ценой, — для фильтра «Только неполные». */
export function offSiteUnits(units: readonly UnitRecord[], layouts: ReadonlyMap<string, UnitsLayout>): Set<string> {
  return new Set(units.filter((unit) => unitSiteGaps(unit, layouts).length > 0).map((unit) => unit.id));
}
