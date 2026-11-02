import { ComplexDocumentsForm } from "@/components/ComplexDocumentsForm";
import { saveComplexDocumentsAction } from "@/lib/admin/actions/complexContent";
import { readComplexDocuments } from "@/lib/admin/server/complexContent";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Документы» (ТЗ 7.8): даты проверки — на сайте только проверенные. */
export default async function ComplexDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "documents");
  if (!complex) return null;
  const documents = await readComplexDocuments(await createSupabaseServerClient(), complex.id);
  return <ComplexDocumentsForm key={complex.id} complexId={complex.id} documents={documents} action={saveComplexDocumentsAction} />;
}
