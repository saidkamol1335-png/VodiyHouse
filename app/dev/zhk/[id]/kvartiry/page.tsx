import { notFound } from "next/navigation";
import { ComplexUnitsTab } from "@/components/ComplexUnitsTab";
import { DEV_VIEWER } from "@/lib/admin/access";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoUnitsTab } from "@/lib/admin/complexes/demoUnits";
import { demoUnitsScenario } from "@/lib/admin/complexes/demoUnitsScenarios";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { cabinetPerson } from "@/lib/admin/person";
import { unitsTabView } from "@/lib/admin/units/view";
import {
  demoCreateBlockUnitsAction,
  demoReadBlockUnitsAction,
  demoRevertUnitsStatusAction,
  demoSaveRisersAction,
  demoSetUnitsStatusAction,
} from "../../unitsActions";
import {
  demoAddUnitAction,
  demoDeleteBlockUnitsAction,
  demoDeleteUnitsAction,
  demoSetUnitsFinishingAction,
  demoSetUnitsPriceAction,
  demoUpdateUnitAction,
} from "../../unitsEditActions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

type DevComplexUnitsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blok?: string | string[]; demo?: string | string[] }>;
};

/**
 * Вкладка «Квартиры» на DEMO: Shodlik — блоки со списком, Namuna — генератор. ?demo=… —
 * сценарий стенда (demoUnitsScenarios): страница и действия видят один и тот же.
 */
export default async function DevComplexUnitsPage({
  params,
  searchParams,
}: DevComplexUnitsPageProps) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const { blok, demo } = await searchParams;
  const scenario = demoUnitsScenario(demo);
  const base = `/dev/zhk/${complex.id}`;
  return (
    <ComplexUnitsTab
      view={unitsTabView(demoUnitsTab(complex.id, blok, scenario))}
      tabHref={complexTabHref(base, "units")}
      blocksHref={complexTabHref(base, "blocks")}
      layoutsHref={complexTabHref(base, "layouts")}
      published={complex.status === "published"}
      createAction={demoCreateBlockUnitsAction}
      saveRisersAction={demoSaveRisersAction.bind(null, scenario)}
      listActions={{
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
      }}
      viewerName={(await cabinetPerson(DEV_VIEWER)).name}
      switchQuery={scenario ? `demo=${scenario}` : null}
    />
  );
}
