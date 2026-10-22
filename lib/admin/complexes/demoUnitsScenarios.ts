import type { UnitRecord } from "@/lib/units";
import type { UnitsBlock, UnitsFinishing, UnitsLayout } from "../units/types";
import { demoPlanUnits } from "./demoUnitsPlan";

// Сценарии стенда «Квартир» (?demo=…), чтобы e2e проверял то, чего в DEMO-сиде нет: variety —
// номера с буквами, цена за м², квартиры без планировки, своя отделка, блок B в сумах; big — блок
// на пределе в 5000 квартир; fail — база отказывает в статусе; conflict — статус успел поменять
// другой сотрудник; empty — список удалили, пока страница была открыта (чтение пустое); notready —
// ЖК на сайте, и снятая цена убрала бы «цену от» (vh:not_ready). Каждый сценарий привязан к
// действиям через .bind: без общего состояния между воркерами Playwright.

export const DEMO_UNITS_SCENARIOS = [
  "variety",
  "big",
  "fail",
  "conflict",
  "empty",
  "notready",
] as const;
export type DemoUnitsScenario = (typeof DEMO_UNITS_SCENARIOS)[number] | null;

export function demoUnitsScenario(value: unknown): DemoUnitsScenario {
  return (DEMO_UNITS_SCENARIOS as readonly unknown[]).includes(value)
    ? (value as DemoUnitsScenario)
    : null;
}

type Tab = {
  blocks: UnitsBlock[];
  block: UnitsBlock | null;
  layouts: UnitsLayout[];
  finishings: UnitsFinishing[];
  units: UnitRecord[];
};

const finishingId = (finishings: readonly UnitsFinishing[], name: string) =>
  finishings.find((item) => item.name === name)?.id ?? null;

/** Блок A: «12» → «12А», «40» → «40Б»; эт. 5 — цена за м²; поз. 4 эт. 12 — без планировки. */
function variety(tab: Tab): Tab {
  const turnkey = finishingId(tab.finishings, "Под ключ");
  const units = tab.units.map((unit) => {
    const number = unit.number === "12" ? "12А" : unit.number === "40" ? "40Б" : unit.number;
    const perM2 = unit.floor === 5 && unit.price !== null;
    const noLayout = unit.position === 4 && unit.floor === 12;
    return {
      ...unit,
      number,
      layoutId: noLayout ? null : unit.layoutId,
      price: perM2 ? null : unit.price,
      pricePerM2: perM2 ? 650 : unit.pricePerM2,
      finishingId: unit.floor === 3 ? turnkey : unit.finishingId,
    };
  });
  if (tab.block?.name !== "B") return { ...tab, units };
  // Блок B в сумах: цены (и за м²) те же числа × 12 800 — проверить вывод «… сум».
  const block = { ...tab.block, currency: "UZS" as const };
  const inSum = units.map((unit) => ({
    ...unit,
    price: unit.price === null ? null : unit.price * 12_800,
    pricePerM2: unit.pricePerM2 === null ? null : unit.pricePerM2 * 12_800,
  }));
  return { ...tab, block, units: inSum };
}

/** 10 подъездов × эт. 3–12 × 50 = 5000: предел блока. */
function big(tab: Tab): Tab {
  if (!tab.block || tab.block.unitCount === 0) return tab;
  const plan = {
    entrances: 10,
    floors: 12,
    firstResidentialFloor: 3,
    unitsPerFloor: Array.from({ length: 10 }, () => 50),
    startNumber: 1,
  };
  const cycled = Array.from({ length: 50 }, (_, index) => tab.layouts[index % tab.layouts.length]!);
  const units = demoPlanUnits(tab.block.id, plan, tab.layouts.length > 0 ? cycled : [], {
    free: 1500,
    reserved: 200,
  });
  const block = { ...tab.block, floorsTotal: 12, unitCount: units.length };
  const blocks = tab.blocks.map((item) => (item.id === block.id ? block : item));
  return { ...tab, blocks, block, units };
}

export function applyDemoUnitsScenario(scenario: DemoUnitsScenario, tab: Tab): Tab {
  if (scenario === "variety") return variety(tab);
  if (scenario === "big") return big(tab);
  return tab;
}
