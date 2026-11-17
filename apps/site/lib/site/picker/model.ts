import type { FloorPlan, PickerUnit, Point, UnitContour } from "./records";

// «Выбрать квартиру» (фаза 4, мокап SiteJkPick / MobJkFloor): этажи блока со свободными, план
// этажа и подъезда, квартира на месте контура. Без React — компоненты и тесты зовут одно и то же.

/** points для <polygon> в viewBox 0 0 100 100. */
export const polygonPoints = (points: readonly Point[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

export type Box = { x0: number; x1: number; y0: number; y1: number; cx: number; cy: number };

/** Рамка контура: подпись блока — над серединой, подпись квартиры — в её середине. */
export function boxOf(points: readonly Point[]): Box {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export type FloorCount = { floor: number; free: number; total: number };

const countOf = (units: readonly PickerUnit[]) => ({
  free: units.filter((unit) => unit.status === "free").length,
  total: units.length,
});

/**
 * Этажи блока — сверху вниз, со свободными и всего квартир: где есть план, и где есть квартиры (этаж без
 * плана — сеткой, правки 15.11, п. 19).
 */
export function blockFloors(plans: readonly FloorPlan[], blockId: string, units: readonly PickerUnit[]): FloorCount[] {
  const floors = new Set<number>(units.map((unit) => unit.floor));
  for (const plan of plans) {
    if (plan.blockId !== blockId) continue;
    for (let floor = plan.floorFrom; floor <= plan.floorTo; floor += 1) floors.add(floor);
  }
  return [...floors]
    .sort((a, b) => b - a)
    .map((floor) => ({ floor, ...countOf(units.filter((unit) => unit.floor === floor)) }));
}

/** Этаж по умолчанию — где свободных больше; при равенстве — выше (мокап: перебор сверху вниз). */
export function bestFloor(floors: readonly FloorCount[]): number | null {
  let best: FloorCount | null = null;
  for (const floor of floors) if (!best || floor.free > best.free) best = floor;
  return best?.floor ?? null;
}

export type EntranceCount = { entrance: number | null; free: number; total: number };

/** Подъезды этажа, у которых есть план (null — один план на весь этаж). */
export function floorEntrances(
  plans: readonly FloorPlan[],
  blockId: string,
  floor: number,
  units: readonly PickerUnit[],
): EntranceCount[] {
  const onFloor = plans.filter((plan) => plan.blockId === blockId && plan.floorFrom <= floor && floor <= plan.floorTo);
  const floorUnits = units.filter((unit) => unit.floor === floor);
  return onFloor
    .map((plan) => ({
      entrance: plan.entrance,
      ...countOf(plan.entrance === null ? floorUnits : floorUnits.filter((unit) => unit.entrance === plan.entrance)),
    }))
    .sort((a, b) => (a.entrance ?? 0) - (b.entrance ?? 0));
}

/** Подъезд по умолчанию — где свободных больше, при равенстве — первый. */
export function bestEntrance(entrances: readonly EntranceCount[]): number | null {
  let best: EntranceCount | null = null;
  for (const item of entrances) if (!best || item.free > best.free) best = item;
  return best?.entrance ?? null;
}

export function planFor(
  plans: readonly FloorPlan[],
  blockId: string,
  floor: number,
  entrance: number | null,
): FloorPlan | null {
  return (
    plans.find(
      (plan) =>
        plan.blockId === blockId &&
        plan.floorFrom <= floor &&
        floor <= plan.floorTo &&
        (plan.entrance === null || plan.entrance === entrance),
    ) ?? null
  );
}

export type PlacedUnit = { contour: UnitContour; unit: PickerUnit | null };

/** Квартиры плана на этаже: контур места → квартира (подъезд, этаж, позиция) или пустое место. */
export function placeUnits(plan: FloorPlan, floor: number, units: readonly PickerUnit[]): PlacedUnit[] {
  return plan.contours.map((contour) => ({
    contour,
    unit:
      units.find(
        (unit) => unit.floor === floor && unit.entrance === contour.entrance && unit.position === contour.position,
      ) ?? null,
  }));
}

export type EntranceGroup = { entrance: number; units: PickerUnit[] };

/** Сетка этажа без плана: квартиры по подъездам, в подъезде — по стоякам (позиции). */
export function entranceGroups(units: readonly PickerUnit[]): EntranceGroup[] {
  const groups = new Map<number, PickerUnit[]>();
  for (const unit of units) groups.set(unit.entrance, [...(groups.get(unit.entrance) ?? []), unit]);
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([entrance, list]) => ({ entrance, units: [...list].sort((a, b) => a.position - b.position || a.number.localeCompare(b.number)) }));
}
