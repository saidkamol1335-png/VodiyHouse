import { notFound } from "next/navigation";
import { ComplexUnitsTab } from "@/components/ComplexUnitsTab";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoUnitsTab } from "@/lib/admin/complexes/demoUnits";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { unitsTabView } from "@/lib/admin/units/view";
import { demoCreateBlockUnitsAction, demoSaveRisersAction } from "../../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

type DevComplexUnitsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blok?: string | string[] }>;
};

/** Вкладка «Квартиры» на DEMO: Shodlik — блоки со списком (стояки), Namuna — генератор. */
export default async function DevComplexUnitsPage({
  params,
  searchParams,
}: DevComplexUnitsPageProps) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const { blok } = await searchParams;
  const base = `/dev/zhk/${complex.id}`;
  return (
    <ComplexUnitsTab
      view={unitsTabView(demoUnitsTab(complex.id, blok))}
      tabHref={complexTabHref(base, "units")}
      blocksHref={complexTabHref(base, "blocks")}
      layoutsHref={complexTabHref(base, "layouts")}
      published={complex.status === "published"}
      createAction={demoCreateBlockUnitsAction}
      saveRisersAction={demoSaveRisersAction}
    />
  );
}
