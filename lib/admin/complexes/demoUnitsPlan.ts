import {
  applyRisers,
  defaultRisers,
  generateUnits,
  type BlockPlan,
  type UnitRecord,
} from "@/lib/units";
import type { UnitsLayout } from "../units/types";

// Квартиры DEMO по плану блока: цена — формула мокапа (площадь × $700 × поправка за этаж, до $10),
// статусы — по хешу номера, чтобы свободные были разбросаны по этажам.

const PRICE_PER_M2 = 700;

export const demoUnitId = (blockId: string, n: number) =>
  `${n.toString(16).padStart(8, "0")}-0000-4000-8000-${blockId.slice(-12)}`;

/** Порядок «свободна → бронь → продана» по хешу номера: свободные разбросаны по этажам. */
const scatter = (number: string) => (Number(number) * 2654435761) % 1000;

export function demoUnitPrice(area: number, floor: number): number {
  const factor = 1 + 0.006 * (floor - 2) - (floor === 2 ? 0.02 : 0);
  return Math.round((area * PRICE_PER_M2 * factor) / 10) * 10;
}

/** Квартиры плана: позиция i — i-я планировка (лишним позициям — без), статусы — по хешу номера. */
export function demoPlanUnits(
  blockId: string,
  plan: BlockPlan,
  layouts: readonly UnitsLayout[],
  counts: { free: number; reserved: number },
): UnitRecord[] {
  const risers = defaultRisers(plan).map((riser, index) => ({
    ...riser,
    layoutId: layouts[index]?.id ?? null,
  }));
  const units = applyRisers(generateUnits(plan), risers);
  const place = new Map(
    [...units]
      .sort((a, b) => scatter(a.number) - scatter(b.number))
      .map((unit, index) => [unit.number, index]),
  );
  return units.map((unit, index) => {
    const order = place.get(unit.number)!;
    const area = layouts.find((layout) => layout.id === unit.layoutId)?.area ?? null;
    const status =
      order < counts.free ? "free" : order < counts.free + counts.reserved ? "reserved" : "sold";
    return {
      id: demoUnitId(blockId, index + 1),
      entrance: unit.entrance,
      floor: unit.floor,
      position: unit.position,
      number: unit.number,
      layoutId: unit.layoutId,
      price: area === null ? null : demoUnitPrice(area, unit.floor),
      pricePerM2: null,
      finishingId: null,
      status,
      updatedAt: "2026-10-21T09:41:00Z",
      updatedByName: status === "free" ? null : "Дилноза Юсупова",
    };
  });
}
