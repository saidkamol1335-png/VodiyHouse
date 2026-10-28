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

/** Этажи блока, на которые есть план, — сверху вниз, со свободными и всего квартир. */
export function blockFloors(plans: readonly FloorPlan[], blockId: string, units: readonly PickerUnit[]): FloorCount[] {
  const floors = new Set<number>();
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

/** Короткая цена плитки мокапа: «$43,6k» (до тысячи — целиком). */
export function shortUsd(amount: number, locale: string): string {
  if (amount < 1000) return `$${Math.round(amount)}`;
  const thousands = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU", { maximumFractionDigits: 1 }).format(
    Math.round(amount / 100) / 10,
  );
  return `$${thousands}k`;
}
