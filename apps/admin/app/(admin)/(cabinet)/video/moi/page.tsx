import { getTranslations } from "next-intl/server";
import { FormStatus } from "@/components/FormStatus";
import { isMineFilter, mineHref, ProgressMine } from "@/components/ProgressMine";
import { ReportDrawer } from "@/components/ProgressReview";
import { ProgressTelegram } from "@/components/ProgressTelegram";
import { VideoLayout } from "@/components/VideoLayout";
import type { CabinetViewer } from "@/lib/admin/access";
import { idParam } from "@/lib/admin/progress/params";
import { readAuthorProgressReports, readReportDetail } from "@/lib/admin/server/progress";
import { hasStaffTelegram } from "@/lib/admin/server/progressNotify";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type Search = Record<string, string | string[] | undefined>;

async function Mine({ viewer, search }: { viewer: CabinetViewer; search: Search }) {
  const t = await getTranslations("admin.video.mine");
  const supabase = await createSupabaseServerClient();
  const filter = isMineFilter(search.status) ? search.status : "all";
  const reportId = idParam(search.report);
  const mobile = viewer.role === "mobilographer";
  const [items, linked, report] = await Promise.all([
    readAuthorProgressReports(supabase, viewer.id, { status: filter === "all" ? undefined : filter }),
    mobile ? hasStaffTelegram(viewer.id).catch(() => false) : false,
    reportId ? readReportDetail(supabase, reportId) : null,
  ]);
  const sent = search.sent === "1" ? t("sent") : search.sent === "quiet" ? t("sentQuiet") : null;
  const top = (
    <>
      {sent ? <FormStatus tone="success">{sent}</FormStatus> : null}
      {mobile ? <ProgressTelegram linked={linked} /> : null}
    </>
  );
  return (
    <>
      <ProgressMine items={items} filter={filter} top={top} />
      {report ? <ReportDrawer key={report.id} report={report} canReview={false} closeHref={mineHref(filter)} /> : null}
    </>
  );
}

/** «Мои отчёты» (фаза E): свои отчёты по статусам; у мобилографа сверху — уведомления в Telegram (п. 36). */
export default async function MyReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  return <VideoLayout tab="mine">{(viewer) => <Mine viewer={viewer} search={search} />}</VideoLayout>;
}
