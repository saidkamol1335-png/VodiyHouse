import { HEAD_STAND } from "../../stand";
import { UnitsStand } from "../../unitsStand";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

type DevComplexUnitsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blok?: string | string[]; demo?: string | string[] }>;
};

/** Вкладка «Квартиры» руководителя на DEMO; ?demo=… — сценарий стенда (demoUnitsScenarios). */
export default async function DevComplexUnitsPage({
  params,
  searchParams,
}: DevComplexUnitsPageProps) {
  const [{ id }, { blok, demo }] = await Promise.all([params, searchParams]);
  return <UnitsStand stand={HEAD_STAND} id={id} blok={blok} demo={demo} />;
}
