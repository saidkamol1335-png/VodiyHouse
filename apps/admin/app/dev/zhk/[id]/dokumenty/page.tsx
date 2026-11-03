import { notFound } from "next/navigation";
import { ComplexDocumentsForm } from "@/components/ComplexDocumentsForm";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { demoDocuments } from "@/lib/admin/complexes/demoContent";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { demoSaveDocumentsAction } from "../../contentActions";
import { demoMainFormProps } from "../../demoMainForm";
import { HEAD_STAND } from "../../stand";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета.
export const instant = false;

/** Вкладка «Документы и проверки» на DEMO: даты проверки — как в сиде, визит сотрудника. */
export default async function DevComplexDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  return (
    <>
      <ComplexDocumentsForm key={complex.id} complexId={complex.id} documents={demoDocuments(complex.id)} action={demoSaveDocumentsAction} />
      <ComplexMainForm key={`${complex.id}-checks`} section="checks" {...await demoMainFormProps(complex, HEAD_STAND.base)} />
    </>
  );
}
