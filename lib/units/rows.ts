// Данные для функций базы квартир — имена колонок в одном месте, а не в каждом серверном
// действии. Блок функция берёт из своего аргумента, а не из строк.

import type { GeneratedUnit } from "./blockPlan";
import type { LayoutChange } from "./risers";

export type UnitInsertRow = {
  layout_id: string | null;
  entrance: number;
  floor: number;
  position: number;
  number: string;
};

/** Строки для create_block_units — генератор и стояки (generateUnits + applyRisers). */
export function toUnitInsertRows(
  units: ReadonlyArray<GeneratedUnit & { layoutId: string | null }>,
): UnitInsertRow[] {
  return units.map((unit) => ({
    layout_id: unit.layoutId,
    entrance: unit.entrance,
    floor: unit.floor,
    position: unit.position,
    number: unit.number,
  }));
}

/** Пары для set_units_layouts: ключ layout_id обязателен, null — снять планировку. */
export function toUnitLayoutItems(changes: readonly LayoutChange[]) {
  return changes.map((change) => ({ id: change.id, layout_id: change.layoutId }));
}
