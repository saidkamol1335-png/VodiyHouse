// Правки прочитанного списка в браузере: подтверждённая смена статуса и новое чтение. Строки,
// которых правка не коснулась, остаются теми же объектами — список из 5000 строк не
// перерисовывается целиком из-за одной квартиры (строки сравниваются по ссылке).

import { sortUnitsByNumber } from "./list";
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

/** Поля, которые правят массово: цена (целиком или за м²) и отделка. */
export type UnitFieldsPatch = Partial<Pick<UnitRecord, "price" | "pricePerM2" | "finishingId">>;

/**
 * Массовая цена или отделка: новый объект и «только что · имя» — только у квартир, где значение
 * и правда поменялось (база меняет так же: строку с тем же значением не трогает).
 */
export function withFields(
  units: readonly UnitRecord[],
  ids: ReadonlySet<string>,
  fields: UnitFieldsPatch,
  stamp: UnitStamp,
): UnitRecord[] {
  const keys = Object.keys(fields) as (keyof UnitFieldsPatch)[];
  return units.map((unit) => {
    if (!ids.has(unit.id) || keys.every((key) => unit[key] === fields[key])) return unit;
    return { ...unit, ...fields, updatedAt: stamp.at, updatedByName: stamp.by };
  });
}

/** Сохранённая или добавленная квартира из ответа базы: заменить по id или вставить, по номерам. */
export function withUnit(units: readonly UnitRecord[], unit: UnitRecord): UnitRecord[] {
  const rest = units.filter((item) => item.id !== unit.id);
  return sortUnitsByNumber([...rest, unit]);
}

export function withoutUnits(units: readonly UnitRecord[], ids: ReadonlySet<string>): UnitRecord[] {
  return units.filter((unit) => !ids.has(unit.id));
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
