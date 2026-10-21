// Вкладка «Квартиры» для браузера: сервер квартиры не читает — после каждого тапа статуса
// updateTag перерисовывает страницу, и 5000 строк читались бы на каждый тап («Решения 12.4»).
// Список читает экран, стояки готового блока собираются из прочитанного.

import { planFromUnits, risersFromUnits, type UnitRecord } from "@/lib/units";
import type {
  ReadyBlockView,
  UnitsBlock,
  UnitsFinishing,
  UnitsLayout,
  UnitsTabView,
} from "./types";

type UnitsTabData = {
  blocks: UnitsBlock[];
  block: UnitsBlock | null;
  layouts: UnitsLayout[];
  finishings: UnitsFinishing[];
};

export function unitsTabView({ blocks, block, layouts, finishings }: UnitsTabData): UnitsTabView {
  return { blocks, block, layouts, finishings };
}

/** Стояки и границы готового блока из прочитанного списка; пустой список — null. */
export function readyBlockView(
  units: readonly UnitRecord[],
  floorsTotal: number | null,
): ReadyBlockView | null {
  if (units.length === 0) return null;
  return {
    count: units.length,
    plan: planFromUnits(units, floorsTotal),
    risers: risersFromUnits(units),
  };
}
