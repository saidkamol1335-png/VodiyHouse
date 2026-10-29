import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ReportDrawer, ReviewQueue } from "@/components/ProgressReview";
import { ProgressReportForm } from "@/components/ProgressReportForm";
import { VideoScreen } from "@/components/VideoScreen";
import { isCabinetOpenWithoutLogin, type StaffRole } from "@/lib/admin/access";
import { cabinetPerson } from "@/lib/admin/person";
import { reportMonths } from "@/lib/admin/progress/types";
import {
  readMyProgressReports,
  readProgressFormComplexes,
  readProgressReportForFix,
  readReportDetail,
  readReviewQueue,
} from "@/lib/admin/server/progress";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idFrom = (raw: string | string[] | undefined) =>
  typeof raw === "string" && UUID.test(raw) ? raw : null;

/** Видеограф: ЖК для формы, «Мои отчёты» и возвращённый отчёт из ?fix. */
async function readReporterScreen(supabase: SupabaseClient, fixId: string | null) {
  const [complexes, mine, found] = await Promise.all([
    readProgressFormComplexes(supabase),
    readMyProgressReports(supabase),
    fixId ? readProgressReportForFix(supabase, fixId) : null,
  ]);
  // «Исправить» (5B.4): только возвращённый отчёт ЖК, который ещё строится; его месяц — в выборе.
  const fix = found && complexes.some((complex) => complex.id === found.complexId) ? found : null;
  const current = reportMonths(new Date());
  const months = fix && !current.includes(fix.month) ? [fix.month, ...current] : current;
  return { complexes, mine, fix, months };
}

/** Экран роли: видеограф — свои отчёты (CabVideo); менеджер и руководитель — проверка (CabReview). */
async function RoleScreen({ role, fixId }: { role: StaffRole; fixId: string | null }) {
  const supabase = await createSupabaseServerClient();
  if (role !== "videographer") return <ReviewQueue items={await readReviewQueue(supabase)} />;
  const { complexes, mine, fix, months } = await readReporterScreen(supabase, fixId);
  return (
    <VideoScreen
      form={
        <ProgressReportForm
          key={fix?.id ?? "new"}
          complexes={complexes}
          months={months}
          fix={fix}
        />
      }
      mine={mine}
    />
  );
}

/** Ящик отчёта из ?report: решение — у менеджера и руководителя. */
async function OpenReport({ id, role }: { id: string | null; role: StaffRole }) {
  if (!id) return null;
  const report = await readReportDetail(await createSupabaseServerClient(), id);
  return report ? (
    <ReportDrawer key={report.id} report={report} canReview={role !== "videographer"} />
  ) : null;
}

/**
 * «Видео и ход стройки» (фаза 5): видеограф — «Новый отчёт», «Как снимать», «Мои отчёты» (мокап
 * CabVideo); менеджер и руководитель — «Ждут проверки» и ящик отчёта с публикацией (CabReview).
 */
export default async function VideoPage({ searchParams }: PageProps<"/admin/video">) {
  const { viewer, allowed } = await requireSection("video");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const title = viewer.role === "videographer" ? t("video.titleVideographer") : t("video.title");
  const topbar = <AdminTopbar title={title} subtitle={t("video.subtitle")} person={person} />;
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.video")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={title}>{t("developers.errors.notConfigured")}</AdminPanel>
      </AdminPage>
    );
  }
  const search = await searchParams;
  return (
    <AdminPage topbar={topbar}>
      <RoleScreen role={viewer.role} fixId={idFrom(search.fix)} />
      <OpenReport id={idFrom(search.report)} role={viewer.role} />
    </AdminPage>
  );
}
