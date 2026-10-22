// Выделение квартир для массовой панели (12.5, «Решаю сам» шага 12): галочки переживают смену
// фильтра — найти номер поиском, отметить, искать следующий; квартиры вне фильтра участвуют в
// действии и видны счётчиком «вне фильтра». Квартир, которых больше нет в списке, в выделении нет.

import type { UnitRecord } from "@/lib/units";

/** Выделенные квартиры, что ещё есть в списке, — по порядку списка. */
export function selectedUnits(
  units: readonly UnitRecord[],
  ids: ReadonlySet<string>,
): UnitRecord[] {
  return ids.size === 0 ? [] : units.filter((unit) => ids.has(unit.id));
}

/** Сколько выделенных не видно при текущем фильтре. */
export function hiddenCount(
  selected: readonly UnitRecord[],
  visible: readonly UnitRecord[],
): number {
  const shown = new Set(visible.map((unit) => unit.id));
  return selected.filter((unit) => !shown.has(unit.id)).length;
}

/** Галочка шапки — по показанным строкам: все, часть или ни одной. */
export function pageCheck(
  shown: readonly UnitRecord[],
  ids: ReadonlySet<string>,
): "none" | "some" | "all" {
  const picked = shown.filter((unit) => ids.has(unit.id)).length;
  if (picked === 0) return "none";
  return picked === shown.length ? "all" : "some";
}

/** Включить или снять галочки у набора квартир, не трогая остальные выделенные. */
export function withSelected(
  ids: ReadonlySet<string>,
  toggled: Iterable<string>,
  on: boolean,
): Set<string> {
  const next = new Set(ids);
  for (const id of toggled) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}
