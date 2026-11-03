import { notFound } from "next/navigation";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoMainFormProps } from "../demoMainForm";
import { HEAD_STAND } from "../stand";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Основное» на DEMO. */
export default async function DevComplexMainPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return <ComplexMainForm key={complex.id} section="main" {...await demoMainFormProps(complex, HEAD_STAND.base)} />;
}
