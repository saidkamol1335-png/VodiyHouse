import { ComplexDetailsForm } from "@/components/ComplexDetailsForm";
import { saveComplexDetailsAction } from "@/lib/admin/actions/complexContent";
import { readComplexDetails } from "@/lib/admin/server/complexContent";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readComplexPhotos } from "@/lib/admin/server/complexTabs";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Детали» (ТЗ 7.7): тексты тем с фото из галереи ЖК. */
export default async function ComplexDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "details");
  if (!complex) return null;
  const supabase = await createSupabaseServerClient();
  const [details, photos] = await Promise.all([readComplexDetails(supabase, complex.id), readComplexPhotos(supabase, complex.id, mediaSrc)]);
  return <ComplexDetailsForm key={complex.id} complexId={complex.id} details={details} photos={photos} action={saveComplexDetailsAction} />;
}
