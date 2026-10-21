// Вход действий «Квартир»: Server Action — открытый POST, поэтому всё, что пришло из браузера,
// проверяется заново (типы, пределы, правила lib/units). Чистые функции — юнит-тесты без Next.

import { PRICE_MAX, PRICE_PER_M2_MAX } from "@/lib/format";
import {
  BLOCK_PLAN_LIMITS,
  foldUnitNumber,
  isUnitNumber,
  isUnitStatus,
  normalizeUnitNumber,
  validateBlockPlan,
  validateRisers,
  type BlockPlan,
  type Riser,
  type UnitStatus,
} from "@/lib/units";
import type { PriceChange, PriceMode, UnitPatch } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

const isInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

/** Выбранные квартиры: uuid без повторов, не больше квартир блока. */
export function readUnitIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(isUuid)) return null;
  const ids = [...new Set(value.map((id) => id.toLowerCase()))];
  return ids.length <= BLOCK_PLAN_LIMITS.totalUnits ? ids : null;
}

export const readStatus = (value: unknown): UnitStatus | null =>
  isUnitStatus(value) ? value : null;

const PRICE_LIMITS: Record<Exclude<PriceMode, "none">, number> = {
  total: PRICE_MAX,
  per_m2: PRICE_PER_M2_MAX,
};

/** Цена Н3: целое > 0 в пределах колонки; «без цены» — без суммы. */
export function readPrice(mode: unknown, value: unknown): PriceChange | null {
  if (mode === "none") return value === null || value === undefined ? { mode, value: null } : null;
  if (mode !== "total" && mode !== "per_m2") return null;
  return isInt(value) && value > 0 && value <= PRICE_LIMITS[mode] ? { mode, value } : null;
}

export const readFinishing = (value: unknown): number | null | undefined =>
  value === null ? null : isInt(value) && value > 0 ? value : undefined;

export const readLayout = (value: unknown): string | null | undefined =>
  value === null ? null : isUuid(value) ? value.toLowerCase() : undefined;

/** Правка строки → патч update_unit (только переданные ключи, имена колонок базы). */
export function readUnitPatch(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  const patch = value as UnitPatch & Record<string, unknown>;
  const allowed = new Set(["number", "layoutId", "price", "finishingId"]);
  if (Object.keys(patch).some((key) => !allowed.has(key)) || Object.keys(patch).length === 0)
    return null;
  const db: Record<string, unknown> = {};
  if ("number" in patch) {
    if (typeof patch.number !== "string" || !isUnitNumber(normalizeUnitNumber(patch.number)))
      return null;
    db.number = normalizeUnitNumber(patch.number);
  }
  if ("layoutId" in patch) {
    const layout = readLayout(patch.layoutId);
    if (layout === undefined) return null;
    db.layout_id = layout;
  }
  if ("price" in patch) {
    const price = readPrice(patch.price?.mode, patch.price?.value);
    if (!price) return null;
    db.price = price;
  }
  if ("finishingId" in patch) {
    const finishing = readFinishing(patch.finishingId);
    if (finishing === undefined) return null;
    db.finishing_id = finishing;
  }
  return db;
}

/** План генератора: целые в пределах таблиц, без лишних полей; правила — validateBlockPlan. */
export function readPlan(value: unknown): BlockPlan | null {
  if (typeof value !== "object" || value === null) return null;
  const { entrances, floors, firstResidentialFloor, unitsPerFloor, startNumber } = value as Record<
    string,
    unknown
  >;
  if (![entrances, floors, firstResidentialFloor, startNumber].every(isInt)) return null;
  if (!Array.isArray(unitsPerFloor) || !unitsPerFloor.every(isInt)) return null;
  const plan: BlockPlan = {
    entrances: entrances as number,
    floors: floors as number,
    firstResidentialFloor: firstResidentialFloor as number,
    unitsPerFloor,
    startNumber: startNumber as number,
  };
  return validateBlockPlan(plan).length === 0 ? plan : null;
}

function readRiser(value: unknown): Riser | null {
  if (typeof value !== "object" || value === null) return null;
  const { entrance, position, floorFrom, floorTo, layoutId } = value as Record<string, unknown>;
  if (!(entrance === null || isInt(entrance)) || ![position, floorFrom, floorTo].every(isInt))
    return null;
  const layout = readLayout(layoutId);
  if (layout === undefined) return null;
  return {
    entrance: entrance as number | null,
    position: position as number,
    floorFrom: floorFrom as number,
    floorTo: floorTo as number,
    layoutId: layout,
  };
}

/** Стояки в границах блока; пересечения одного уровня — отказ (validateRisers). */
export function readRisers(value: unknown, plan: BlockPlan): Riser[] | null {
  if (!Array.isArray(value) || value.length > BLOCK_PLAN_LIMITS.totalUnits) return null;
  const risers = value.map(readRiser);
  if (risers.some((riser) => riser === null)) return null;
  return validateRisers(plan, risers as Riser[]).length === 0 ? (risers as Riser[]) : null;
}

/**
 * «Удалить список блока»: название вводят как угодно — «a», «A», «А». Сравниваем мягко, а в
 * базу передаём название из базы: она проверяет строго и ловит переименование за это время.
 */
export function blockNameConfirmed(typed: string, name: string): boolean {
  const wanted = foldUnitNumber(name);
  return wanted !== "" && foldUnitNumber(typed) === wanted;
}
