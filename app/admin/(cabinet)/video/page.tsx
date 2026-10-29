import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ProgressReportForm } from "@/components/ProgressReportForm";
import { VideoScreen } from "@/components/VideoScreen";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { cabinetPerson } from "@/lib/admin/person";
import { reportMonths } from "@/lib/admin/progress/types";
import { readMyProgressReports, readProgressFormComplexes } from "@/lib/admin/server/progress";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/**
 * «Видео и ход стройки» (фаза 5, мокап CabVideo): видеограф — «Новый отчёт», «Как снимать» и «Мои
 * отчёты». Проверка и публикация для менеджера и руководителя (CabReview) — блок 5D.
 */
export default async function VideoPage() {
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
  const supabase = await createSupabaseServerClient();
  const [complexes, mine] = await Promise.all([
    readProgressFormComplexes(supabase),
    readMyProgressReports(supabase),
  ]);
  return (
    <AdminPage topbar={topbar}>
      <VideoScreen
        form={<ProgressReportForm complexes={complexes} months={reportMonths(new Date())} />}
        mine={mine}
      />
    </AdminPage>
  );
}
