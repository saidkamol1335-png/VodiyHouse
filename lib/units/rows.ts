// Строки для вставки в таблицу units: имена колонок базы в одном месте, а не в каждом
// серверном действии.

import type { GeneratedUnit } from "./blockPlan";

export type UnitInsertRow = {
  block_id: string;
  layout_id: string | null;
  entrance: number;
  floor: number;
  position: number;
  number: string;
};

export function toUnitInsertRows(
  blockId: string,
  units: ReadonlyArray<GeneratedUnit & { layoutId: string | null }>,
): UnitInsertRow[] {
  return units.map((unit) => ({
    block_id: blockId,
    layout_id: unit.layoutId,
    entrance: unit.entrance,
    floor: unit.floor,
    position: unit.position,
    number: unit.number,
  }));
}
