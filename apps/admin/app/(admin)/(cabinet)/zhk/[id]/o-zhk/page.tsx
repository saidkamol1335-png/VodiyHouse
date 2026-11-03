import { ComplexDetailsForm } from "@/components/ComplexDetailsForm";
import { ComplexFaqForm } from "@/components/ComplexFaqForm";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { ComplexVideosForm } from "@/components/ComplexVideosForm";
import { saveComplexDetailsAction, saveComplexFaqAction, saveComplexVideosAction } from "@/lib/admin/actions/complexContent";
import { saveComplexMainAction } from "@/lib/admin/actions/complexes";
import { readComplexDetails, readComplexFaq, readComplexVideos } from "@/lib/admin/server/complexContent";
import { complexMainFormProps } from "@/lib/admin/server/complexMainForm";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readComplexPhotos } from "@/lib/admin/server/complexTabs";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/**
 * Вкладка «О ЖК» (экран 3): описание RU/UZ, детали проекта (ТЗ 7.7), видео (ТЗ 7.5), частые
 * вопросы. Каждый блок сохраняется своей кнопкой — как раздел страницы ЖК на сайте.
 */
export default async function ComplexAboutPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "about");
  if (!complex) return null;
  const supabase = await createSupabaseServerClient();
  const [mainForm, details, photos, videos, faq] = await Promise.all([
    complexMainFormProps(complex),
    readComplexDetails(supabase, complex.id),
    readComplexPhotos(supabase, complex.id, mediaSrc),
    readComplexVideos(supabase, complex.id),
    readComplexFaq(supabase, complex.id),
  ]);
  return (
    <>
      <ComplexMainForm key={`${complex.id}-about`} section="about" action={saveComplexMainAction} {...mainForm} />
      <ComplexDetailsForm key={`${complex.id}-details`} complexId={complex.id} details={details} photos={photos} action={saveComplexDetailsAction} />
      <ComplexVideosForm key={`${complex.id}-videos`} complexId={complex.id} videos={videos} action={saveComplexVideosAction} />
      <ComplexFaqForm key={`${complex.id}-faq`} complexId={complex.id} faq={faq} action={saveComplexFaqAction} />
    </>
  );
}
