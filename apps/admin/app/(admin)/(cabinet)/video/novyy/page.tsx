import { ProgressReportForm } from "@/components/ProgressReportForm";
import { VideoLayout } from "@/components/VideoLayout";
import { VideoScreen } from "@/components/VideoScreen";
import type { CabinetViewer } from "@/lib/admin/access";
import { idParam } from "@/lib/admin/progress/params";
import { shotDateBounds } from "@/lib/admin/progress/types";
import { readProgressFormComplexes, readProgressReportForEdit } from "@/lib/admin/server/progress";
import { withEditTarget } from "@/lib/admin/server/progressScreens";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type Search = Record<string, string | string[] | undefined>;

async function Form({ viewer, search }: { viewer: CabinetViewer; search: Search }) {
  const supabase = await createSupabaseServerClient();
  const id = idParam(search.id);
  const [building, edit] = await Promise.all([
    readProgressFormComplexes(supabase),
    id ? readProgressReportForEdit(supabase, id) : null,
  ]);
  const complexes = await withEditTarget(supabase, building, edit);
  return (
    <VideoScreen
      form={
        <ProgressReportForm
          key={edit?.id ?? "new"}
          complexes={complexes}
          shotBounds={shotDateBounds(new Date())}
          userId={viewer.id}
          role={viewer.role}
          edit={edit}
          start={{ complexId: idParam(search.complex), blockId: idParam(search.block) }}
        />
      }
    />
  );
}

/**
 * «Новый отчёт» (фаза E, пп. 31–33, 37): мобилограф и руководитель. ?id= — свой черновик или возвращённый
 * отчёт; ?complex=&block= — «Снять отчёт» из «Заданий».
 */
export default async function NewReportPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  return <VideoLayout tab="new">{(viewer) => <Form viewer={viewer} search={search} />}</VideoLayout>;
}
