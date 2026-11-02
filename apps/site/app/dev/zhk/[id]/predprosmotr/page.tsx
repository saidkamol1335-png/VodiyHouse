import { notFound } from "next/navigation";
import { ComplexPreviewTab } from "@/components/ComplexPreviewTab";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { complexRoute } from "@/lib/routes";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета.
export const instant = false;

/**
 * «Предпросмотр» на DEMO: у стенда нет входа — во фрейме открытая страница DEMO-ЖК (черновик без
 * сессии сотрудника не откроется: 404).
 */
export default async function DevComplexPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const path = complexRoute(complex.slug);
  return <ComplexPreviewTab key={complex.id} hrefs={{ ru: `/ru${path}`, uz: `/uz${path}` }} />;
}
