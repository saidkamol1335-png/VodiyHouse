import { DEMO_PANEL_RECORDS } from "../programs/demo";
import type { PanelRecord } from "../programs/panels";
import type { CalcDeveloperRecord, ClientCalcRecord } from "./screen";

// DEMO «Расчёта для клиента» (стенд /dev/programmy/raschet): программы — те же, что у стенда
// «Программ оплаты» (сверены с сидом, tests/db/programs-demo.test.ts), квартиры и планировки —
// числа мокапа: кв. 88 · 78 м² · $57 880 (r1), кв. 43 · 64,2 м² · $47 640 (MobFlat), №11, №63, №67.

const layoutId = (n: number) => `00000000-0000-4000-8000-0000000e10${String(n).padStart(2, "0")}`;
const unitId = (n: number) => `00000000-0000-4000-8000-0000000e20${String(n).padStart(2, "0")}`;

type LayoutSeed = {
  n: number;
  block: number;
  rooms: number;
  area: number;
  priceFrom: number | null;
};
type UnitSeed = { n: number; number: string; floor: number; layout: number; price: number | null };

const LAYOUTS: readonly LayoutSeed[] = [
  { n: 1, block: 1, rooms: 2, area: 64.2, priceFrom: 45_480 },
  { n: 2, block: 1, rooms: 3, area: 78, priceFrom: 57_880 },
  { n: 3, block: 1, rooms: 1, area: 42.5, priceFrom: null },
  { n: 4, block: 2, rooms: 2, area: 66, priceFrom: 47_520 },
  { n: 5, block: 3, rooms: 2, area: 58, priceFrom: 55_700 },
  { n: 6, block: 4, rooms: 3, area: 81, priceFrom: 77_760 },
  { n: 7, block: 6, rooms: 2, area: 61.5, priceFrom: 45_800 },
];

const UNITS: readonly UnitSeed[] = [
  { n: 1, number: "11", floor: 4, layout: 1, price: 45_480 },
  { n: 2, number: "43", floor: 12, layout: 1, price: 47_640 },
  { n: 3, number: "63", floor: 6, layout: 1, price: 46_020 },
  { n: 4, number: "67", floor: 7, layout: 1, price: 46_290 },
  { n: 5, number: "88", floor: 12, layout: 2, price: 57_880 },
  { n: 6, number: "5", floor: 2, layout: 3, price: null },
  { n: 7, number: "7", floor: 3, layout: 4, price: 47_520 },
  { n: 8, number: "21", floor: 5, layout: 5, price: 55_700 },
  { n: 9, number: "9", floor: 8, layout: 6, price: 77_760 },
  { n: 10, number: "14", floor: 6, layout: 7, price: 45_800 },
];

const blockN = (id: string) => Number(id.slice(-1));

type PanelBlock = PanelRecord["blocks"][number];

function blockOf(block: PanelBlock, layouts: readonly LayoutSeed[]) {
  return {
    id: block.id,
    name: block.name,
    currency: block.currency,
    layouts: layouts
      .filter((layout) => layout.block === blockN(block.id))
      .map((layout) => ({
        id: layoutId(layout.n),
        rooms: layout.rooms,
        area: layout.area,
        price_from: layout.priceFrom,
        available: layout.priceFrom !== null,
      })),
  };
}

function unitOf(unit: UnitSeed, blocks: readonly PanelBlock[]) {
  const layout = LAYOUTS.find((item) => item.n === unit.layout)!;
  const block = blocks.find((item) => blockN(item.id) === layout.block)!;
  return {
    id: unitId(unit.n),
    number: unit.number,
    floor: unit.floor,
    block_id: block.id,
    layout_id: layoutId(layout.n),
    rooms: layout.rooms,
    area: layout.area,
    price: unit.price,
  };
}

function developerRecord(panel: PanelRecord): CalcDeveloperRecord {
  const own = (block: number) => panel.blocks.some((item) => blockN(item.id) === block);
  const layouts = LAYOUTS.filter((layout) => own(layout.block));
  const complexes = [...new Map(panel.blocks.map((block) => [block.complex_id, block])).values()];
  return {
    id: panel.id,
    slug: panel.slug,
    name: panel.name,
    checked_at: panel.programs_checked_at,
    price_hint: panel.price_hint,
    // Как client_calc_developer: «выбранные» без блоков не действуют — их в расчёте нет.
    programs: panel.programs.filter(
      (item) => item.is_active && (item.blocks_scope === "all" || item.block_ids.length > 0),
    ),
    complexes: complexes.map((complex) => ({
      id: complex.complex_id,
      name: complex.complex_name,
      blocks: panel.blocks
        .filter((block) => block.complex_id === complex.complex_id)
        .map((block) => blockOf(block, layouts)),
    })),
    units: UNITS.filter((unit) => layouts.some((layout) => layout.n === unit.layout)).map((unit) =>
      unitOf(unit, panel.blocks),
    ),
  };
}

/** Как client_calc_screen(p_developer): застройщик по slug, нет такого — первый. */
export function demoClientCalc(slug: string | null): ClientCalcRecord {
  const panel = DEMO_PANEL_RECORDS.find((item) => item.slug === slug) ?? DEMO_PANEL_RECORDS[0]!;
  return {
    developers: DEMO_PANEL_RECORDS.map(({ id, slug: own, name }) => ({ id, slug: own, name })),
    current: developerRecord(panel),
  };
}
