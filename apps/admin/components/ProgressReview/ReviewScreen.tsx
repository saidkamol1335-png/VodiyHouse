import { ClientVideos, ProgressMatrixPanel } from "@/components/ProgressOverview";
import type { StaffRole } from "@/lib/admin/access";
import { readReportDetail, readReviewQueue } from "@/lib/admin/server/progress";
import { readProgressOverview } from "@/lib/admin/server/progressOverview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReportDrawer } from "./ReportDrawer";
import { ReviewQueue } from "./ReviewQueue";

/**
 * «Проверка» руководителя и менеджера (фаза 5, мокап CabReview; фаза E): «Ждут проверки», матрица
 * «Отчёты по ЖК · последние 6 месяцев», «Видео для клиентов» и ящик отчёта из ?report. Решает — только
 * руководитель (PLAN §10, п. 6).
 */
export async function ReviewScreen({ role, reportId }: { role: StaffRole; reportId: string | null }) {
  const supabase = await createSupabaseServerClient();
  const [queue, overview, report] = await Promise.all([
    readReviewQueue(supabase),
    readProgressOverview(supabase, new Date()),
    reportId ? readReportDetail(supabase, reportId) : null,
  ]);
  return (
    <>
      <ReviewQueue items={queue} />
      <ProgressMatrixPanel matrix={overview.matrix} linked />
      <ClientVideos videos={overview.videos} />
      {report ? <ReportDrawer key={`${report.id}-${report.updatedAt}`} report={report} canReview={role === "head"} /> : null}
    </>
  );
}
