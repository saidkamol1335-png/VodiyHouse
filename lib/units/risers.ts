// Стояки (PLAN §7, фаза 1): позиция в подъезде → планировка на диапазон этажей.
// Так одна строка «поз. 1 → 1-комн. 42,5 м², эт. 2–16» назначает планировку сразу 45 квартирам.

import type { BlockPlan, UnitSlot } from "./blockPlan";

export type Riser = {
  /** null — во всех подъездах; номер — только в этом (уточняет общий стояк). */
  entrance: number | null;
  position: number;
  floorFrom: number;
  floorTo: number;
  /** null — планировка ещё не выбрана. */
  layoutId: string | null;
};

export type RiserIssue =
  | { code: "riserEntranceOutOfRange"; riser: number }
  | { code: "riserPositionOutOfRange"; riser: number }
  | { code: "riserFloorsOutOfRange"; riser: number }
  | { code: "riserOverlap"; riser: number; other: number };

/** Стояки по умолчанию: по одному на позицию, все подъезды, все жилые этажи, без планировки. */
export function defaultRisers(plan: BlockPlan): Riser[] {
  const positions = Math.max(0, ...plan.unitsPerFloor);
  return Array.from({ length: positions }, (_, index) => ({
    entrance: null,
    position: index + 1,
    floorFrom: plan.firstResidentialFloor,
    floorTo: plan.floors,
    layoutId: null,
  }));
}

export function validateRisers(plan: BlockPlan, risers: readonly Riser[]): RiserIssue[] {
  const issues: RiserIssue[] = [];
  risers.forEach((riser, index) => {
    const riserNumber = index + 1;
    if (riser.entrance !== null && !isInteger(riser.entrance, 1, plan.entrances)) {
      issues.push({ code: "riserEntranceOutOfRange", riser: riserNumber });
      return;
    }
    if (!isInteger(riser.position, 1, maxPositionFor(plan, riser.entrance))) {
      issues.push({ code: "riserPositionOutOfRange", riser: riserNumber });
    }
    const floorsValid =
      isInteger(riser.floorFrom, plan.firstResidentialFloor, plan.floors) &&
      isInteger(riser.floorTo, riser.floorFrom, plan.floors);
    if (!floorsValid) issues.push({ code: "riserFloorsOutOfRange", riser: riserNumber });
  });
  return [...issues, ...findOverlaps(risers)];
}

/**
 * Стояк квартиры: стояк своего подъезда важнее общего, иначе первый подходящий. Стояк без
 * планировки — тоже стояк: у готового блока он снимает планировку. undefined — вне стояков.
 */
export function riserForSlot(slot: UnitSlot, risers: readonly Riser[]): Riser | undefined {
  const covering = risers.filter((riser) => covers(riser, slot));
  return covering.find((riser) => riser.entrance === slot.entrance) ?? covering[0];
}

/** Планировка квартиры по стоякам; null — без планировки или вне стояков. */
export function layoutForSlot(slot: UnitSlot, risers: readonly Riser[]): string | null {
  return riserForSlot(slot, risers)?.layoutId ?? null;
}

/** Квартиры с назначенной по стоякам планировкой — для создания блока генератором. */
export function applyRisers<T extends UnitSlot>(
  units: readonly T[],
  risers: readonly Riser[],
): Array<T & { layoutId: string | null }> {
  return units.map((unit) => ({ ...unit, layoutId: layoutForSlot(unit, risers) }));
}

export type LayoutChange = { id: string; layoutId: string | null };

/**
 * Для уже созданных квартир: какие планировки поменяются, если сохранить стояки. null —
 * снять планировку (стояк без неё). Квартиры вне стояков не трогаем — их могли править вручную.
 */
export function riserChanges<T extends UnitSlot & { id: string; layoutId: string | null }>(
  units: readonly T[],
  risers: readonly Riser[],
): LayoutChange[] {
  const changes: LayoutChange[] = [];
  for (const unit of units) {
    const riser = riserForSlot(unit, risers);
    if (riser && riser.layoutId !== unit.layoutId) {
      changes.push({ id: unit.id, layoutId: riser.layoutId });
    }
  }
  return changes;
}

/**
 * Сохранение стояков готового блока по снимку (Н5): base — стояки, от которых начинала панель,
 * next — что в ней теперь. Меняются только квартиры, где next даёт другую планировку, чем base;
 * квартиру, которую поправили после снимка (её планировка уже не та, что по base), не трогаем —
 * она в skipped, иначе правка коллеги молча откатилась бы.
 */
export function riserEdits<T extends UnitSlot & { id: string; layoutId: string | null }>(
  units: readonly T[],
  base: readonly Riser[],
  next: readonly Riser[],
): { changes: LayoutChange[]; skipped: T[] } {
  const changes: LayoutChange[] = [];
  const skipped: T[] = [];
  for (const unit of units) {
    const after = riserForSlot(unit, next);
    if (!after) continue;
    const before = riserForSlot(unit, base);
    if (before && before.layoutId === after.layoutId) continue;
    // Вне снимка (новый стояк) ожидаем то, что есть сейчас.
    const expected = before ? before.layoutId : unit.layoutId;
    if (unit.layoutId !== expected) skipped.push(unit);
    else if (unit.layoutId !== after.layoutId)
      changes.push({ id: unit.id, layoutId: after.layoutId });
  }
  return { changes, skipped };
}

function covers(riser: Riser, slot: UnitSlot): boolean {
  return (
    (riser.entrance === null || riser.entrance === slot.entrance) &&
    riser.position === slot.position &&
    slot.floor >= riser.floorFrom &&
    slot.floor <= riser.floorTo
  );
}

// Пересекаться нельзя только стоякам одного уровня: подъезд + подъезд или общий + общий.
// Стояк подъезда поверх общего — это уточнение, а не конфликт.
function findOverlaps(risers: readonly Riser[]): RiserIssue[] {
  const issues: RiserIssue[] = [];
  risers.forEach((riser, index) => {
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const other = risers[otherIndex]!;
      const sameScope = riser.entrance === other.entrance;
      const floorsMeet = riser.floorFrom <= other.floorTo && other.floorFrom <= riser.floorTo;
      if (sameScope && riser.position === other.position && floorsMeet) {
        issues.push({ code: "riserOverlap", riser: index + 1, other: otherIndex + 1 });
      }
    }
  });
  return issues;
}

function maxPositionFor(plan: BlockPlan, entrance: number | null): number {
  if (entrance === null) return Math.max(0, ...plan.unitsPerFloor);
  return plan.unitsPerFloor[entrance - 1] ?? 0;
}

function isInteger(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
