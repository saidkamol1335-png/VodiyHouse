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
/** Список блока читается на клиенте: страница его не несёт («Решения 12.2»). */
export type BlockUnitsInput = { blockId: string };
export type BlockUnitsResult = UnitsResult<{ units: UnitRecord[] }>;
export type ChangedResult = UnitsResult<{ changed: number }>;

// ─── Вкладка «Квартиры»: что видит экран ────────────────────────────────────────────────────

export type UnitsBlock = {
  id: string;
  name: string;
  floorsTotal: number | null;
  /** Отделка блока — у квартиры без своей серым «как в блоке». */
  finishingId: number | null;
  currency: "USD" | "UZS";
  unitCount: number;
};

export type UnitsLayout = {
  id: string;
  rooms: number;
  area: number;
  /** Ручной флаг «доступна» — только у блока без списка квартир (Н7). */
  available: boolean;
  priceFrom: number | null;
};

export type UnitsFinishing = { id: number; name: string; isActive: boolean };

/** Готовый блок: стояки собраны из квартир, границы — для их проверки (Н5). */
export type ReadyBlockView = { count: number; plan: BlockPlan; risers: Riser[] };

/**
 * Вкладка «Квартиры» в браузере — без квартир: список (до 5000) экран читает сам, а стояки
 * собирает из прочитанного (12.4). Есть ли список — по unitCount блока.
 */
export type UnitsTabView = {
  blocks: UnitsBlock[];
  /** null — у ЖК нет блоков. */
  block: UnitsBlock | null;
  layouts: UnitsLayout[];
  finishings: UnitsFinishing[];
};

/** Действие вкладки пропсом: настоящее — Server Action, на стенде — ответ без базы. */
export type UnitsAction<I, R> = (input: I) => Promise<R>;

export type UnitsStatusActions = {
  set: UnitsAction<SetUnitsStatusInput, SetUnitsStatusResult>;
  revert: UnitsAction<RevertUnitsStatusInput, RevertUnitsStatusResult>;
};

/**
 * Правки руководителя (12.5, Н3, Н4). Каждое действие — по отдельности: кнопка есть, только если
 * передано её действие (объём TODO-заказчик «цены — менеджер?» — в lib/admin/units/access.ts).
 */
export type UnitsEditActions = Partial<{
  add: UnitsAction<AddUnitInput, UnitRowResult>;
  update: UnitsAction<UpdateUnitInput, UnitRowResult>;
  remove: UnitsAction<UnitIdsInput, DeleteUnitsResult>;
  removeList: UnitsAction<DeleteBlockUnitsInput, DeleteUnitsResult>;
  price: UnitsAction<SetUnitsPriceInput, SetUnitsPriceResult>;
  finishing: UnitsAction<SetUnitsFinishingInput, ChangedResult>;
}>;

/**
 * Действия списка. Права задаёт наличие действия: без status плашка — просто плашка; без edit —
 * ни правки, ни цены, ни удаления (менеджер, 12.6).
 */
export type UnitsListActions = {
  read: UnitsAction<BlockUnitsInput, BlockUnitsResult>;
  status: UnitsStatusActions | null;
  edit: UnitsEditActions | null;
};

/**
 * Все действия вкладки; роли страница отдаёт только её (unitsActionsFor). Без create — ни
 * генератора, без saveRisers — ни «Стояков», без layoutAvailable — ни «Наличия по планировкам» (Н7).
 */
export type UnitsTabActions = {
  list: UnitsListActions;
  create: UnitsAction<CreateBlockUnitsInput, CreateBlockUnitsResult> | null;
  saveRisers: UnitsAction<SaveRisersInput, SaveRisersResult> | null;
  layoutAvailable: UnitsAction<SetLayoutAvailableInput, ChangedResult> | null;
};
