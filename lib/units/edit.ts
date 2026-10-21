// Правки прочитанного списка в браузере: подтверждённая смена статуса и новое чтение. Строки,
// которых правка не коснулась, остаются теми же объектами — список из 5000 строк не
// перерисовывается целиком из-за одной квартиры (строки сравниваются по ссылке).

import type { UnitRecord } from "./record";
import type { UnitStatus } from "./status";

/** Кто и когда поменял — «только что · имя» в строке без нового чтения. */
export type UnitStamp = { at: string; by: string | null };

export function withStatuses(
  units: readonly UnitRecord[],
  next: ReadonlyMap<string, UnitStatus>,
  stamp: UnitStamp,
): UnitRecord[] {
  return units.map((unit) => {
    const status = next.get(unit.id);
    if (status === undefined || status === unit.status) return unit;
    return { ...unit, status, updatedAt: stamp.at, updatedByName: stamp.by };
  });
}

/** Все поля квартиры, кроме id: новое поле UnitRecord без строки здесь — ошибка typecheck. */
export const UNIT_FIELDS = [
  "entrance",
  "floor",
  "position",
  "number",
  "layoutId",
  "price",
  "pricePerM2",
  "finishingId",
  "status",
  "updatedAt",
  "updatedByName",
] as const satisfies readonly (keyof UnitRecord)[];

// Проверка полноты: поле UnitRecord, которого нет в UNIT_FIELDS, не проходит ограничение never.
type Covered<Left extends never> = Left;
export type UnitFieldsCovered = Covered<
  Exclude<keyof UnitRecord, (typeof UNIT_FIELDS)[number] | "id">
>;

const sameUnit = (a: UnitRecord, b: UnitRecord) =>
  UNIT_FIELDS.every((field) => a[field] === b[field]);

/** Новое чтение поверх прежнего: неизменённые квартиры — прежние объекты. */
export function reuseUnchanged(
  previous: readonly UnitRecord[] | null,
  fresh: readonly UnitRecord[],
): UnitRecord[] {
  if (!previous) return [...fresh];
  const byId = new Map(previous.map((unit) => [unit.id, unit]));
  return fresh.map((unit) => {
    const old = byId.get(unit.id);
    return old && sameUnit(old, unit) ? old : unit;
  });
}
