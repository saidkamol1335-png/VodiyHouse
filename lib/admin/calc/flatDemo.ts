import type { FlatCalcRecord, FlatUnitRecord } from "@/lib/calc/flatScreen";
import { demoClientCalc } from "./demo";
import { demoSiteCalc } from "./siteDemo";

// DEMO «Расчёта для этой квартиры» (стенд /dev/raschet-kvartiry): ЖК Shodlik застройщика
// demo-sifat — программы как у /kalkulyator (без полей скидки), квартиры как у «Расчёта для
// клиента» плюс кв. 8 · 3 эт. · $54 930 из мокапа SiteJkCalc1. Ответ — как у site_layout_calc().

const DEVELOPER = "demo-sifat";

/** Кв. 8 мокапа SiteJkCalc1 («3-комн. · 78 м²», «Квартира · свободно: 2»). */
const MOCKUP_UNITS: readonly (FlatUnitRecord & { area: number })[] = [
  { id: "00000000-0000-4000-8000-0000000e2011", number: "8", floor: 3, price: 54_930, area: 78 },
];

export type DemoFlatLayout = { id: string; rooms: number; area: number; blockName: string };

function demoLayouts() {
  const current = demoSiteCalc(DEVELOPER).current!;
  return current.complexes.flatMap((complex) =>
    complex.blocks.flatMap((block) => block.layouts.map((layout) => ({ complex, block, layout }))),
  );
}

/** Планировки стенда — карточки «Рассчитать оплату», как раздел «Планировки» страницы ЖК. */
export function demoFlatLayouts(): DemoFlatLayout[] {
  return demoLayouts()
    .filter(({ layout }) => layout.available)
    .map(({ block, layout }) => ({
      id: layout.id,
      rooms: layout.rooms,
      area: Number(layout.area),
      blockName: block.name,
    }));
}

function unitsOf(layoutId: string, area: number): FlatUnitRecord[] {
  const cabinet = demoClientCalc(DEVELOPER).current!.units.filter(
    (unit) => unit.layout_id === layoutId,
  );
  // Площадь 78 м² у DEMO-застройщика одна — у планировки кв. 88 (блок A).
  const mockup = MOCKUP_UNITS.filter((unit) => unit.area === area);
  return [...cabinet, ...mockup]
    .map(({ id, number, floor, price }) => ({ id, number, floor, price }))
    .sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number));
}

/** Как site_layout_calc(p_layout): планировки нет на сайте — null. */
export function demoFlatCalc(layoutId: string | null): FlatCalcRecord | null {
  const site = demoSiteCalc(DEVELOPER);
  const found = demoLayouts().find(({ layout }) => layout.id === layoutId);
  if (!found || !site.current) return null;
  const { complex, block, layout } = found;
  const units = unitsOf(layout.id, Number(layout.area));
  const prices = units.map((unit) => Number(unit.price)).filter((price) => price > 0);
  return {
    rate: site.rate,
    developer: { name: site.current.name, checked_at: site.current.checked_at },
    complex: { id: complex.id, name: complex.name },
    block: { id: block.id, name: block.name, currency: block.currency },
    // «Цена от» — как private.layout_offers: минимум свободных квартир с ценой.
    layout: {
      ...layout,
      price_from: prices.length ? Math.min(...prices) : layout.price_from,
      drawing: null,
    },
    units,
    programs: site.current.programs.filter(
      (program) => program.blocks_scope === "all" || program.block_ids.includes(block.id),
    ),
  };
}
