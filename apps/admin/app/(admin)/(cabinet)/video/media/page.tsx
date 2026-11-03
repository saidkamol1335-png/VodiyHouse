import { MediaComplexes, MediaComplexView } from "@/components/ProgressMedia";
import { VideoLayout } from "@/components/VideoLayout";
import { idParam } from "@/lib/admin/progress/params";
import { readMediaComplex, readMediaComplexes } from "@/lib/admin/server/progressScreens";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type Search = Record<string, string | string[] | undefined>;

async function Media({ complexId }: { complexId: string | null }) {
  const supabase = await createSupabaseServerClient();
  const complex = complexId ? await readMediaComplex(supabase, complexId) : null;
  if (complex) return <MediaComplexView complex={complex} />;
  return <MediaComplexes items={await readMediaComplexes(supabase)} />;
}

/** «Медиа ЖК» (фаза E, п. 35): все сотрудники; ?complex= — опубликованные отчёты ЖК по месяцам. */
export default async function MediaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  return <VideoLayout tab="media">{() => <Media complexId={idParam(search.complex)} />}</VideoLayout>;
}
