import { notFound } from "next/navigation";
import { ComplexDocumentsForm } from "@/components/ComplexDocumentsForm";
import { demoDocuments } from "@/lib/admin/complexes/demoContent";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoSaveDocumentsAction } from "../../contentActions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета.
export const instant = false;

/** Вкладка «Документы» на DEMO: даты проверки — как в сиде. */
export default async function DevComplexDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return <ComplexDocumentsForm key={complex.id} complexId={complex.id} documents={demoDocuments(complex.id)} action={demoSaveDocumentsAction} />;
}
