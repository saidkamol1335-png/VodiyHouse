import { notFound } from "next/navigation";
import { ComplexBlocksForm } from "@/components/ComplexBlocksForm";
import { DEMO_FINISHING_OPTIONS, demoBlocks } from "@/lib/admin/complexes/demoBlocks";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoSaveComplexBlocksAction } from "../../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Блоки» на DEMO: у Shodlik — A (сдан) и B (строится 58 %) со списками квартир. */
export default async function DevComplexBlocksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return (
    <ComplexBlocksForm
      key={complex.id}
      complexId={complex.id}
      blocks={demoBlocks(complex.id)}
      finishings={DEMO_FINISHING_OPTIONS}
      action={demoSaveComplexBlocksAction}
    />
  );
}
