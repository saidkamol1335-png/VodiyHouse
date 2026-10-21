// Входы и ответы действий вкладки «Квартиры» (шаг 12). Отдельно от "use server"-файлов: их
// импортируют и клиентские компоненты (12.3–12.6).

import type { BlockPlan, Riser, UnitRecord, UnitStatus, UnitsUndo } from "@/lib/units";
import type { ComplexRequirement } from "../complexes/readiness";
import type { ContentErrorCode } from "../developers/errors";

/** Что подсветить в форме: detail отказа vh:invalid функции базы. */
export const UNIT_ERROR_FIELDS = [
  "number",
  "slot",
  "layout_id",
  "price",
  "finishing_id",
  "floors_total",
] as const;
export type UnitErrorField = (typeof UNIT_ERROR_FIELDS)[number];

export type UnitsActionError = {
  status: "error";
  error: ContentErrorCode;
  field: UnitErrorField | null;
  /** Чего не хватит опубликованному ЖК после правки (vh:not_ready). */
  broken: ComplexRequirement[];
};

export type UnitsResult<T extends object> = ({ status: "done" } & T) | UnitsActionError;

export type PriceMode = "total" | "per_m2" | "none";
/** value — целое, без копеек (как вводит кабинет); при «none» — null. */
export type PriceChange = { mode: PriceMode; value: number | null };

export type UnitIdsInput = { blockId: string; unitIds: readonly string[] };

export type CreateBlockUnitsInput = { blockId: string; plan: BlockPlan; risers: readonly Riser[] };
export type CreateBlockUnitsResult = UnitsResult<{ created: number; unassigned: number }>;

export type AddUnitInput = {
  blockId: string;
  entrance: number;
  floor: number;
  position: number;
  number: string;
  layoutId: string | null;
};

/** Только изменённые поля строки (Н4): правка номера не трогает цену, поставленную массово. */
export type UnitPatch = {
  number?: string;
  layoutId?: string | null;
  price?: PriceChange;
  finishingId?: number | null;
};
export type UpdateUnitInput = { blockId: string; unitId: string; patch: UnitPatch };
export type UnitRowResult = UnitsResult<{ unit: UnitRecord }>;

export type DeleteUnitsResult = UnitsResult<{ deleted: number }>;
export type DeleteBlockUnitsInput = { blockId: string; confirm: string };

export type SetUnitsStatusInput = UnitIdsInput & { status: UnitStatus };
export type SetUnitsStatusResult = UnitsResult<{ changed: number; undo: UnitsUndo }>;
export type RevertUnitsStatusInput = { blockId: string; status: UnitStatus; undo: UnitsUndo };
/** skipped — номера, что за эти секунды поменял другой сотрудник; missing — удалённые. */
export type RevertUnitsStatusResult = UnitsResult<{
  reverted: number;
  skipped: string[];
  missing: number;
}>;

export type SetUnitsPriceInput = UnitIdsInput & PriceChange;
/** withoutLayout — квартиры без планировки при цене за м²: на сайте «цена по запросу». */
export type SetUnitsPriceResult = UnitsResult<{ changed: number; withoutLayout: number }>;
export type SetUnitsFinishingInput = UnitIdsInput & { finishingId: number | null };
/** base — стояки, от которых начинала панель (снимок); risers — что в ней теперь. */
export type SaveRisersInput = { blockId: string; base: readonly Riser[]; risers: readonly Riser[] };
/** skipped — номера квартир, которые поправили после снимка: их не тронули. */
export type SaveRisersResult = UnitsResult<{ changed: number; skipped: string[] }>;
export type SetLayoutAvailableInput = { layoutId: string; available: boolean };
export type ChangedResult = UnitsResult<{ changed: number }>;
