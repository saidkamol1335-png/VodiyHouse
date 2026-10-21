// Готовый блок (Н5): стояки отдельно не хранятся — их строки собираются из планировок квартир,
// а границы для проверки стояков — из самих квартир и этажности блока («Решения 12.1»).

import type { BlockPlan, UnitSlot } from "./blockPlan";
import type { Riser } from "./risers";

type PlacedUnit = UnitSlot & { layoutId: string | null };

/**
 * Границы готового блока для validateRisers: подъезды и позиции — по квартирам, верхний этаж —
 * этажность блока (её может не быть — тогда по квартирам), нижний — первый этаж с квартирами.
 */
export function planFromUnits(units: readonly UnitSlot[], floorsTotal: number | null): BlockPlan {
  const entrances = Math.max(1, ...units.map((unit) => unit.entrance));
  const unitsPerFloor = Array.from({ length: entrances }, (_, index) =>
    Math.max(
      1,
      ...units.filter((unit) => unit.entrance === index + 1).map((unit) => unit.position),
    ),
  );
  const floors = units.map((unit) => unit.floor);
  return {
    entrances,
    floors: floorsTotal ?? Math.max(1, ...floors),
    firstResidentialFloor: floors.length > 0 ? Math.min(...floors) : 1,
    unitsPerFloor,
    startNumber: 1,
  };
}

/** Подряд идущие этажи с одним значением → [от, до, значение]; разрыв этажа рвёт ряд. */
function runsOf(values: ReadonlyMap<number, string | null>) {
  const runs: Array<{ floorFrom: number; floorTo: number; layoutId: string | null }> = [];
  for (const floor of [...values.keys()].sort((a, b) => a - b)) {
    const layoutId = values.get(floor)!;
    const last = runs.at(-1);
    if (last && last.floorTo === floor - 1 && last.layoutId === layoutId) last.floorTo = floor;
    else runs.push({ floorFrom: floor, floorTo: floor, layoutId });
  }
  return runs;
}

/** Этаж → планировка квартир позиции в подъезде. */
function floorsOf(units: readonly PlacedUnit[], entrance: number, position: number) {
  const byFloor = new Map<number, string | null>();
  for (const unit of units) {
    if (unit.entrance === entrance && unit.position === position)
      byFloor.set(unit.floor, unit.layoutId);
  }
  return byFloor;
}

/**
 * Стояки по квартирам: где у всех подъездов блока на этаже одна планировка — общий стояк, где
 * расходятся — стояк подъезда. Сохранить их без правок — ничего не меняет у квартир.
 */
export function risersFromUnits(units: readonly PlacedUnit[]): Riser[] {
  const entrances = [...new Set(units.map((unit) => unit.entrance))].sort((a, b) => a - b);
  const positions = [...new Set(units.map((unit) => unit.position))].sort((a, b) => a - b);
  const risers: Riser[] = [];
  for (const position of positions) {
    const perEntrance = new Map(
      entrances.map((entrance) => [entrance, floorsOf(units, entrance, position)]),
    );
    const common = commonFloors(perEntrance);
    for (const run of runsOf(common)) risers.push({ entrance: null, position, ...run });
    for (const [entrance, byFloor] of perEntrance) {
      const own = new Map([...byFloor].filter(([floor]) => !common.has(floor)));
      for (const run of runsOf(own)) risers.push({ entrance, position, ...run });
    }
  }
  return risers;
}

/** Этажи, где квартира позиции есть в каждом подъезде и планировка у всех одна. */
function commonFloors(perEntrance: ReadonlyMap<number, ReadonlyMap<number, string | null>>) {
  const [first, ...rest] = [...perEntrance.values()];
  const common = new Map<number, string | null>();
  if (!first) return common;
  for (const [floor, layoutId] of first) {
    if (rest.every((byFloor) => byFloor.has(floor) && byFloor.get(floor) === layoutId)) {
      common.set(floor, layoutId);
    }
  }
  return common;
}
