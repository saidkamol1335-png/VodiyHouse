import { ComplexDocumentsForm } from "@/components/ComplexDocumentsForm";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { saveComplexDocumentsAction } from "@/lib/admin/actions/complexContent";
import { saveComplexMainAction } from "@/lib/admin/actions/complexes";
import { readComplexDocuments } from "@/lib/admin/server/complexContent";
import { complexMainFormProps } from "@/lib/admin/server/complexMainForm";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/**
 * Вкладка «Документы и проверки» (экран 3, ТЗ 7.8): документы с датами проверки — на сайте только
 * проверенные; визит сотрудника — «Проверено Vodiy House».
 */
export default async function ComplexDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "documents");
  if (!complex) return null;
  const [documents, mainForm] = await Promise.all([
    readComplexDocuments(await createSupabaseServerClient(), complex.id),
    complexMainFormProps(complex),
  ]);
  return (
    <>
      <ComplexDocumentsForm key={complex.id} complexId={complex.id} documents={documents} action={saveComplexDocumentsAction} />
      <ComplexMainForm key={`${complex.id}-checks`} section="checks" action={saveComplexMainAction} {...mainForm} />
    </>
  );
}
