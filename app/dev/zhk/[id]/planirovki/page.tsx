import { notFound } from "next/navigation";
import { ComplexLayoutsForm } from "@/components/ComplexLayoutsForm";
import { demoLayouts } from "@/lib/admin/complexes/demoLayouts";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoUnitsScenario, withUnavailableSample } from "@/lib/admin/complexes/demoUnitsScenarios";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { demoSaveBlockLayoutsAction } from "../../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

type DevComplexLayoutsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string | string[] }>;
};

/**
 * Вкладка «Планировки» на DEMO: чертежи остаются в браузере (без облака). ?demo=variety — как у
 * «Квартир»: у блока без списка вторая планировка «нет в наличии» (плашка вместо галочки, 12.6).
 */
export default async function DevComplexLayoutsPage({
  params,
  searchParams,
}: DevComplexLayoutsPageProps) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const variety = demoUnitsScenario((await searchParams).demo) === "variety";
  const blocks = demoLayouts(complex.id).map((block) =>
    variety && !block.hasUnits
      ? { ...block, layouts: withUnavailableSample(block.layouts) }
      : block,
  );
  return (
    <ComplexLayoutsForm
      key={complex.id}
      complexId={complex.id}
      published={complex.status === "published"}
      blocks={blocks}
      action={demoSaveBlockLayoutsAction}
      attach={null}
      blocksHref={complexTabHref(`/dev/zhk/${complex.id}`, "blocks")}
    />
  );
}
