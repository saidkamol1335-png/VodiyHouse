import { ComplexVideosForm } from "@/components/ComplexVideosForm";
import { saveComplexVideosAction } from "@/lib/admin/actions/complexContent";
import { readComplexVideos } from "@/lib/admin/server/complexContent";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Видео» (ТЗ 7.5): ролики YouTube по порядку. */
export default async function ComplexVideosPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "videos");
  if (!complex) return null;
  const videos = await readComplexVideos(await createSupabaseServerClient(), complex.id);
  return <ComplexVideosForm key={complex.id} complexId={complex.id} videos={videos} action={saveComplexVideosAction} />;
}
