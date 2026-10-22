import { notFound } from "next/navigation";
import { ComplexUnitsTab } from "@/components/ComplexUnitsTab";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoUnitsTab } from "@/lib/admin/complexes/demoUnits";
import {
  demoUnitsScenario,
  type DemoUnitsScenario,
} from "@/lib/admin/complexes/demoUnitsScenarios";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { cabinetPerson } from "@/lib/admin/person";
import { unitsActionsFor } from "@/lib/admin/units/access";
import type { UnitsTabActions } from "@/lib/admin/units/types";
import { unitsTabView } from "@/lib/admin/units/view";
import { devOnlyStand, type ComplexStand } from "./stand";
import {
  demoCreateBlockUnitsAction,
  demoReadBlockUnitsAction,
  demoRevertUnitsStatusAction,
  demoSaveRisersAction,
  demoSetLayoutAvailableAction,
  demoSetUnitsStatusAction,
} from "./unitsActions";
import {
  demoAddUnitAction,
  demoDeleteBlockUnitsAction,
  demoDeleteUnitsAction,
  demoSetUnitsFinishingAction,
  demoSetUnitsPriceAction,
  demoUpdateUnitAction,
} from "./unitsEditActions";

/** Все действия стенда со сценарием (?demo=…): страница и действия видят один и тот же. */
function demoActions(scenario: DemoUnitsScenario): UnitsTabActions {
  return {
    list: {
      read: demoReadBlockUnitsAction.bind(null, scenario),
      status: {
        set: demoSetUnitsStatusAction.bind(null, scenario),
        revert: demoRevertUnitsStatusAction.bind(null, scenario),
      },
      edit: {
        add: demoAddUnitAction.bind(null, scenario),
        update: demoUpdateUnitAction.bind(null, scenario),
        remove: demoDeleteUnitsAction.bind(null, scenario),
        removeList: demoDeleteBlockUnitsAction.bind(null, scenario),
        price: demoSetUnitsPriceAction.bind(null, scenario),
        finishing: demoSetUnitsFinishingAction.bind(null, scenario),
      },
    },
    create: demoCreateBlockUnitsAction,
    saveRisers: demoSaveRisersAction.bind(null, scenario),
    layoutAvailable: demoSetLayoutAvailableAction.bind(null, scenario),
  };
}

type UnitsStandProps = { stand: ComplexStand; id: string; blok: unknown; demo: unknown };

/**
 * Вкладка «Квартиры» на DEMO: Shodlik — блоки со списком, Namuna — блок без списка (Н7 и
 * генератор). Роли — те же действия, что у /admin (unitsActionsFor).
 */
export async function UnitsStand({ stand, id, blok, demo }: UnitsStandProps) {
  devOnlyStand();
  const complex = demoComplex(id);
  if (!complex) notFound();
  const scenario = demoUnitsScenario(demo);
  const base = `${stand.base}/${complex.id}`;
  return (
    <ComplexUnitsTab
      view={unitsTabView(demoUnitsTab(complex.id, blok, scenario))}
      tabHref={complexTabHref(base, "units")}
      blocksHref={complexTabHref(base, "blocks")}
      layoutsHref={complexTabHref(base, "layouts")}
      published={complex.status === "published"}
      actions={unitsActionsFor(stand.viewer.role, demoActions(scenario))}
      viewerName={(await cabinetPerson(stand.viewer)).name}
      switchQuery={scenario ? `demo=${scenario}` : null}
    />
  );
}
