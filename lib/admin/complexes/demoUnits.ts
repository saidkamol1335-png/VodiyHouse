import {
  applyRisers,
  defaultRisers,
  generateUnits,
  type BlockPlan,
  type UnitRecord,
} from "@/lib/units";
import type { UnitsBlock, UnitsLayout } from "../units/types";
import { DEMO_COMPLEX_ROWS } from "./demo";
import { demoBlocks } from "./demoBlocks";
import { demoLayouts } from "./demoLayouts";

// Квартиры DEMO для стенда /dev/zhk/<id>/kvartiry — как supabase/demo/seed.sql: Shodlik A и B —
// 2 подъезда × эт. 2–12 × 4, позиция i — i-я планировка блока; цена — формула мокапа (площадь ×
// $700 × поправка за этаж, до $10). Свободных — как «41 в продаже · Бл. A: 12 · Бл. B: 29».

const PLAN: BlockPlan = {
  entrances: 2,
  floors: 12,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4],
  startNumber: 1,
};
const PRICE_PER_M2 = 700;
const FREE: Record<string, number> = { A: 12, B: 29 };
const RESERVED = 2;

const unitId = (blockId: string, n: number) =>
  `${n.toString(16).padStart(8, "0")}-0000-4000-8000-${blockId.slice(-12)}`;

/** Порядок «свободна → бронь → продана» по хешу номера: свободные разбросаны по этажам. */
const scatter = (number: string) => (Number(number) * 2654435761) % 1000;

function priceOf(area: number, floor: number): number {
  const factor = 1 + 0.006 * (floor - 2) - (floor === 2 ? 0.02 : 0);
  return Math.round((area * PRICE_PER_M2 * factor) / 10) * 10;
}

function blockUnits(
  blockId: string,
  blockName: string,
  layouts: readonly UnitsLayout[],
): UnitRecord[] {
  const risers = defaultRisers(PLAN).map((riser, index) => ({
    ...riser,
    layoutId: layouts[index]?.id ?? null,
  }));
  const units = applyRisers(generateUnits(PLAN), risers);
  const order = [...units]
    .sort((a, b) => scatter(a.number) - scatter(b.number))
    .map((unit) => unit.number);
  const free = FREE[blockName] ?? 0;
  return units.map((unit, index) => {
    const place = order.indexOf(unit.number);
    const area = layouts.find((layout) => layout.id === unit.layoutId)?.area ?? null;
    const status = place < free ? "free" : place < free + RESERVED ? "reserved" : "sold";
    return {
      id: unitId(blockId, index + 1),
      entrance: unit.entrance,
      floor: unit.floor,
      position: unit.position,
      number: unit.number,
      layoutId: unit.layoutId,
      price: area === null ? null : priceOf(area, unit.floor),
      pricePerM2: null,
      finishingId: null,
      status,
      updatedAt: "2026-10-21T09:41:00Z",
      updatedByName: status === "free" ? null : "Дилноза Юсупова",
    };
  });
}

/** Вкладка «Квартиры» DEMO — та же форма, что readUnitsTab у настоящей базы. */
export function demoUnitsTab(complexId: string, wantedBlock: unknown) {
  const drafts = demoBlocks(complexId);
  const layoutsOf = new Map(
    demoLayouts(complexId).map((block) => [
      block.blockId,
      block.layouts.map((layout) => ({
        id: layout.id!,
        rooms: layout.rooms ?? 0,
        area: Number(layout.area.replace(",", ".")),
        available: layout.available,
        priceFrom: layout.priceFrom ? Number(layout.priceFrom.replace(/\s/g, "")) : null,
      })),
    ]),
  );
  const blocks: UnitsBlock[] = drafts.map((draft) => ({
    id: draft.id!,
    name: draft.name,
    floorsTotal: draft.floorsTotal ? Number(draft.floorsTotal) : null,
    finishingId: draft.finishingId ? Number(draft.finishingId) : null,
    currency: draft.currency,
    unitCount: draft.units,
  }));
  const block = blocks.find((item) => item.id === wantedBlock) ?? blocks[0] ?? null;
  const layouts = block ? (layoutsOf.get(block.id) ?? []) : [];
  const units = block && block.unitCount > 0 ? blockUnits(block.id, block.name, layouts) : [];
  return { blocks, block, layouts, units };
}

/** Квартиры DEMO-блока по его id — стенду «Сохранить стояки», где ЖК не передаётся. */
export function demoBlockUnits(
  blockId: string,
): { floors: number | null; units: UnitRecord[] } | null {
  for (const row of DEMO_COMPLEX_ROWS) {
    const tab = demoUnitsTab(row.id, blockId);
    if (tab.block?.id === blockId) return { floors: tab.block.floorsTotal, units: tab.units };
  }
  return null;
}
