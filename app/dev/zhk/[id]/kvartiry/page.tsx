import { notFound } from "next/navigation";
import { ComplexUnitsSummary } from "@/components/ComplexUnitsSummary";
import { demoBlocks } from "@/lib/admin/complexes/demoBlocks";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { complexTabHref } from "@/lib/admin/complexes/tabs";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

// Свободные по блокам — как «41 в продаже · Бл. A: 12 · Бл. B: 29» мокапа.
const DEMO_FREE: Record<string, number> = { A: 12, B: 29 };

/** Вкладка «Квартиры» на DEMO: сводка по блокам до шага 12. */
export default async function DevComplexUnitsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const blocks = demoBlocks(complex.id).map((block) => ({
    blockId: block.id!,
    name: block.name,
    units: block.units,
    free: block.units > 0 ? (DEMO_FREE[block.name] ?? 0) : null,
  }));
  const base = `/dev/zhk/${complex.id}`;
  return (
    <ComplexUnitsSummary
      blocks={blocks}
      blocksHref={complexTabHref(base, "blocks")}
      layoutsHref={complexTabHref(base, "layouts")}
    />
  );
}
