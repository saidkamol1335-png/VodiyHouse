import { notFound } from "next/navigation";
import { ComplexLayoutsForm } from "@/components/ComplexLayoutsForm";
import { demoLayouts } from "@/lib/admin/complexes/demoLayouts";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { demoSaveBlockLayoutsAction } from "../../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Планировки» на DEMO: чертежи остаются в браузере (без облака). */
export default async function DevComplexLayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return (
    <ComplexLayoutsForm
      key={complex.id}
      complexId={complex.id}
      published={complex.status === "published"}
      blocks={demoLayouts(complex.id)}
      action={demoSaveBlockLayoutsAction}
      attach={null}
      blocksHref={complexTabHref(`/dev/zhk/${complex.id}`, "blocks")}
    />
  );
}
