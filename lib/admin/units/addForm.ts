// «+ Квартира» (Н4): место на этаже и номер. Подъезд и позиция — до существующих + 1 (новый
// подъезд начинается с позиции 1), этаж — 1…этажность блока. Квартира создаётся свободной и без
// цены; планировка подставляется по стояку, пока её не трогали.

import { BLOCK_PLAN_LIMITS, isUnitNumber, normalizeUnitNumber, type UnitRecord } from "@/lib/units";
import type { UnitSlot } from "@/lib/units/blockPlan";
import type { AddUnitInput } from "./types";

export type AddDraft = { entrance: string; floor: string; position: string; number: string };

export type AddLimits = {
  maxEntrance: number;
  /** Позиция в подъезде: до существующих + 1; у нового подъезда — только 1. */
  maxPosition: (entrance: number) => number;
  floors: number;
};

const MAX = BLOCK_PLAN_LIMITS.unitsPerFloor.max;

/** Что о квартире нужно форме: место и номер (добавленная — ещё без ответа базы). */
type Placed = Pick<UnitRecord, "entrance" | "floor" | "position" | "number">;

export function addLimits(units: readonly Placed[], floorsTotal: number): AddLimits {
  const positions = new Map<number, number>();
  for (const unit of units)
    positions.set(unit.entrance, Math.max(positions.get(unit.entrance) ?? 0, unit.position));
  const maxEntrance = Math.min(
    BLOCK_PLAN_LIMITS.entrances.max,
    Math.max(0, ...positions.keys()) + 1,
  );
  return {
    maxEntrance,
    maxPosition: (entrance) => Math.min(MAX, (positions.get(entrance) ?? 0) + 1),
    floors: floorsTotal,
  };
}

export const slotOccupant = <T extends Placed>(units: readonly T[], slot: UnitSlot) =>
  units.find(
    (unit) =>
      unit.entrance === slot.entrance &&
      unit.floor === slot.floor &&
      unit.position === slot.position,
  ) ?? null;

/** Следующий номер после самого большого числового: «12А» и «3/10» не мешают. */
export function nextUnitNumber(units: readonly Placed[]): string {
  let max = 0;
  for (const unit of units) {
    const prefix = /^\d+/.exec(unit.number);
    if (prefix) max = Math.max(max, Number(prefix[0]));
  }
  return String(max + 1);
}

/** Первое свободное место: подъезд 1, первый жилой этаж (ниже квартир нет), свободная позиция. */
export function addDraftDefaults(units: readonly UnitRecord[], limits: AddLimits): AddDraft {
  const floor = units.length > 0 ? Math.min(...units.map((unit) => unit.floor)) : 1;
  let position = 1;
  while (position < limits.maxPosition(1) && slotOccupant(units, { entrance: 1, floor, position }))
    position += 1;
  return {
    entrance: "1",
    floor: String(floor),
    position: String(position),
    number: nextUnitNumber(units),
  };
}

/**
 * После «Добавить»: следующий номер и следующая свободная позиция того же этажа среди уже
 * существующих позиций — иначе место остаётся (новый стояк — осознанный выбор, его вводят сами).
 * Что поменяли, пока шёл запрос, не трогается.
 */
export function nextAddDraft(
  sent: AddDraft,
  current: AddDraft,
  units: readonly Placed[],
): AddDraft {
  const entrance = Number(current.entrance);
  const floor = Number(current.floor);
  const sameEntrance = units.filter((unit) => unit.entrance === entrance);
  const positions = Math.max(0, ...sameEntrance.map((unit) => unit.position));
  let position = Number(current.position);
  for (let next = 1; next <= positions; next += 1)
    if (!slotOccupant(units, { entrance, floor, position: next })) {
      position = next;
      break;
    }
  return {
    ...current,
    position: current.position === sent.position ? String(position) : current.position,
    number: current.number === sent.number ? nextUnitNumber(units) : current.number,
  };
}

export type AddIssues = {
  entrance?: boolean;
  floor?: boolean;
  position?: boolean;
  /** Номер квартиры, что уже стоит на этом месте. */
  slotTaken?: string;
  number?: "invalid" | "taken";
};

const whole = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw) : NaN);

function slotIssues(draft: AddDraft, limits: AddLimits): AddIssues {
  const [entrance, floor, position] = [draft.entrance, draft.floor, draft.position].map(whole);
  const issues: AddIssues = {};
  if (!(entrance! >= 1 && entrance! <= limits.maxEntrance)) issues.entrance = true;
  if (!(floor! >= 1 && floor! <= limits.floors)) issues.floor = true;
  if (!issues.entrance && !(position! >= 1 && position! <= limits.maxPosition(entrance!)))
    issues.position = true;
  return issues;
}

/** Черновик → вход add_unit или что не так (место занято, номер занят — без запроса). */
export function readAddDraft(
  draft: AddDraft,
  units: readonly UnitRecord[],
  limits: AddLimits,
): { input: Omit<AddUnitInput, "blockId" | "layoutId"> } | { issues: AddIssues } {
  const issues = slotIssues(draft, limits);
  const slot = {
    entrance: whole(draft.entrance),
    floor: whole(draft.floor),
    position: whole(draft.position),
  };
  const occupant = Object.keys(issues).length === 0 ? slotOccupant(units, slot) : null;
  if (occupant) issues.slotTaken = occupant.number;
  const number = normalizeUnitNumber(draft.number);
  if (!isUnitNumber(number)) issues.number = "invalid";
  else if (units.some((unit) => unit.number === number)) issues.number = "taken";
  if (Object.keys(issues).length > 0) return { issues };
  return { input: { ...slot, number } };
}
