import { DEMO_COMPLEX_ROWS } from "./demo";
import { demoBlocks } from "./demoBlocks";
import { sortLayouts, type BlockLayouts, type LayoutDraft } from "./layouts";

// Планировки DEMO для стенда /dev/zhk/<id>/planirovki — комнаты и площади как supabase/demo/seed.sql;
// у блоков Shodlik со списком квартир «цена от» и «свободно» — как карточки планировок мокапа.
// Чертежей у DEMO нет (их дают застройщики) — плашка «нет чертежа».

type Plan = [rooms: number, area: number, offer?: [price: number, free: number], price?: number];

const PLANS: Record<string, Record<string, Plan[]>> = {
  "demo-shodlik": {
    A: [
      [1, 42.5, [31000, 2]],
      [1, 46.8, [32100, 4]],
      [2, 67.1, [47820, 4]],
      [3, 78, [54930, 2]],
    ],
    B: [
      [1, 44.1, [31060, 8]],
      [2, 58.7, [40270, 8]],
      [2, 64.2, [45480, 9]],
      [3, 84.3, [59720, 3]],
    ],
  },
  "demo-namuna": {
    "1": [
      [0, 34.2, undefined, 33000],
      [1, 48.6, undefined, 46000],
      [1, 52.4],
      [2, 71.3],
      [2, 76.8],
      [3, 98.5],
      [4, 132],
    ],
  },
};

const layoutId = (block: string, index: number) =>
  `00000000-0000-4000-8000-0000000${block.padStart(2, "0").slice(-2)}a${String(index).padStart(2, "0")}`;

function draftOf(blockId: string, plan: Plan, index: number, hasUnits: boolean): LayoutDraft {
  const [rooms, area, offer, price] = plan;
  return {
    key: `${blockId}-${index}`,
    id: layoutId(blockId.slice(-2), index),
    rooms,
    area: String(area).replace(".", ","),
    drawingId: null,
    drawingSrc: null,
    priceFrom: price ? String(price) : "",
    available: true,
    saved: { available: true, priceFrom: price ? String(price) : "" },
    units: hasUnits ? 11 : 0,
    offer: hasUnits && offer ? { priceFrom: offer[0], freeCount: offer[1] } : null,
  };
}

export function demoLayouts(complexId: string): BlockLayouts[] {
  const slug = DEMO_COMPLEX_ROWS.find((row) => row.id === complexId)?.slug ?? "";
  return demoBlocks(complexId).map((block) => {
    const hasUnits = block.units > 0;
    const plans = PLANS[slug]?.[block.name] ?? [];
    return {
      blockId: block.id!,
      blockName: block.name,
      currency: block.currency,
      hasUnits,
      layouts: sortLayouts(plans.map((plan, index) => draftOf(block.id!, plan, index, hasUnits))),
    };
  });
}
