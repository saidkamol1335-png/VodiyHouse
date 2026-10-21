import type { BlockPlan, UnitRecord } from "@/lib/units";
import { SEED_DICTIONARIES } from "../dictionaries/seed";
import type { UnitsBlock, UnitsFinishing, UnitsLayout } from "../units/types";
import { DEMO_COMPLEX_ROWS } from "./demo";
import { demoBlocks } from "./demoBlocks";
import { demoLayouts } from "./demoLayouts";
import { demoPlanUnits } from "./demoUnitsPlan";
import { applyDemoUnitsScenario, type DemoUnitsScenario } from "./demoUnitsScenarios";

// Квартиры DEMO для стенда /dev/zhk/<id>/kvartiry — как supabase/demo/seed.sql: Shodlik A и B —
// 2 подъезда × эт. 2–12 × 4, позиция i — i-я планировка блока. Свободных — как «41 в продаже ·
// Бл. A: 12 · Бл. B: 29».
// Сценарии стенда (?demo=…: разнообразие, 5000 квартир) — demoUnitsScenarios.ts.

const PLAN: BlockPlan = {
  entrances: 2,
  floors: 12,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4],
  startNumber: 1,
};
const FREE: Record<string, number> = { A: 12, B: 29 };
const RESERVED = 2;

function layoutsByBlock(complexId: string) {
  return new Map(
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
}

export const DEMO_FINISHINGS: UnitsFinishing[] = SEED_DICTIONARIES.finishings.map((item) => ({
  id: item.id,
  name: item.name.ru,
  isActive: item.isActive,
}));

export type DemoUnitsTab = {
  blocks: UnitsBlock[];
  block: UnitsBlock | null;
  layouts: UnitsLayout[];
  finishings: UnitsFinishing[];
  units: UnitRecord[];
};

/** Вкладка «Квартиры» DEMO — та же форма, что readUnitsTab у настоящей базы, и список блока. */
export function demoUnitsTab(
  complexId: string,
  wantedBlock: unknown,
  scenario: DemoUnitsScenario = null,
): DemoUnitsTab {
  const layoutsOf = layoutsByBlock(complexId);
  const blocks: UnitsBlock[] = demoBlocks(complexId).map((draft) => ({
    id: draft.id!,
    name: draft.name,
    floorsTotal: draft.floorsTotal ? Number(draft.floorsTotal) : null,
    finishingId: draft.finishingId ? Number(draft.finishingId) : null,
    currency: draft.currency,
    unitCount: draft.units,
  }));
  const block = blocks.find((item) => item.id === wantedBlock) ?? blocks[0] ?? null;
  const layouts = block ? (layoutsOf.get(block.id) ?? []) : [];
  const counts = { free: (block && FREE[block.name]) ?? 0, reserved: RESERVED };
  const units = block && block.unitCount > 0 ? demoPlanUnits(block.id, PLAN, layouts, counts) : [];
  const tab = { blocks, block, layouts, finishings: DEMO_FINISHINGS, units };
  return applyDemoUnitsScenario(scenario, tab);
}

/** Квартиры DEMO-блока по его id — действиям стенда, куда ЖК не передаётся. */
export function demoBlockUnits(
  blockId: string,
  scenario: DemoUnitsScenario = null,
): { floors: number | null; units: UnitRecord[] } | null {
  for (const row of DEMO_COMPLEX_ROWS) {
    const tab = demoUnitsTab(row.id, blockId, scenario);
    if (tab.block?.id === blockId) return { floors: tab.block.floorsTotal, units: tab.units };
  }
  return null;
}
