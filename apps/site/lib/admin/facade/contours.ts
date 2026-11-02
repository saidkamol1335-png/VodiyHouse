// Контуры фасада и планов этажей (фаза 4): точки — проценты картинки [x, y], 0–100, до двух знаков.
// Те же правила, что у базы (private.is_contour, private.is_unit_contours): 3–40 точек, до 200
// квартир на плане, место на этаже (подъезд + позиция) — один раз. Без React — форма, действие и тесты.

export type Point = [number, number];

export type UnitContour = { entrance: number; position: number; points: Point[] };

export const CONTOUR_POINTS = { min: 3, max: 40 } as const;
export const PLAN_CONTOURS_MAX = 200;

const isPercent = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

/** Точка щелчка в процентах картинки, с округлением до сотых и в пределах 0–100. */
export function percentPoint(x: number, y: number, width: number, height: number): Point {
  const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
  return [clamp((x / width) * 100), clamp((y / height) * 100)];
}

/** null — не контур (меньше 3 или больше 40 точек, точка вне 0–100). */
export function parseContour(value: unknown): Point[] | null {
  if (!Array.isArray(value) || value.length < CONTOUR_POINTS.min || value.length > CONTOUR_POINTS.max) return null;
  const points: Point[] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length !== 2 || !isPercent(point[0]) || !isPercent(point[1])) return null;
    points.push([point[0], point[1]]);
  }
  return points;
}

const isSlot = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 50;

/** Контуры квартир плана; entrance — подъезд плана (null — весь этаж): чужой подъезд — отказ. */
export function parseUnitContours(value: unknown, entrance: number | null): UnitContour[] | null {
  if (!Array.isArray(value) || value.length > PLAN_CONTOURS_MAX) return null;
  const seen = new Set<string>();
  const contours: UnitContour[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { entrance: itemEntrance, position, points } = item as Record<string, unknown>;
    const parsed = parseContour(points);
    if (!isSlot(itemEntrance) || !isSlot(position) || !parsed) return null;
    if (entrance !== null && itemEntrance !== entrance) return null;
    const slot = `${itemEntrance}:${position}`;
    if (seen.has(slot)) return null;
    seen.add(slot);
    contours.push({ entrance: itemEntrance, position, points: parsed });
  }
  return contours;
}

export const slotKey = (entrance: number, position: number) => `${entrance}:${position}`;

export type FloorRange = { from: number; to: number };

/** Этажи плана: целые 1–100, «с» не выше «по», не выше этажности блока. */
export function parseFloorRange(from: unknown, to: unknown, floorsTotal: number | null): FloorRange | null {
  const [a, b] = [Number(from), Number(to)];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b > 100 || a > b) return null;
  if (floorsTotal !== null && b > floorsTotal) return null;
  return { from: a, to: b };
}
