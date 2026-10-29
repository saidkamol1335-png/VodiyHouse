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
import {
  readMyProgressReports,
  readProgressFormComplexes,
  readProgressReportForFix,
} from "@/lib/admin/server/progress";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ЖК для формы, «Мои отчёты» и возвращённый отчёт из ?fix — сессией сотрудника. */
async function readVideoScreen(fixId: string | string[] | undefined) {
  const supabase = await createSupabaseServerClient();
  const [complexes, mine, found] = await Promise.all([
    readProgressFormComplexes(supabase),
    readMyProgressReports(supabase),
    typeof fixId === "string" && UUID.test(fixId)
      ? readProgressReportForFix(supabase, fixId)
      : null,
  ]);
  // «Исправить» (5B.4): только возвращённый отчёт ЖК, который ещё строится; его месяц — в выборе.
  const fix = found && complexes.some((complex) => complex.id === found.complexId) ? found : null;
  const current = reportMonths(new Date());
  const months = fix && !current.includes(fix.month) ? [fix.month, ...current] : current;
  return { complexes, mine, fix, months };
}

/**
 * «Видео и ход стройки» (фаза 5, мокап CabVideo): видеограф — «Новый отчёт», «Как снимать» и «Мои
 * отчёты». Проверка и публикация для менеджера и руководителя (CabReview) — блок 5D.
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
  const { fix: fixId } = await searchParams;
  const { complexes, mine, fix, months } = await readVideoScreen(fixId);
  return (
    <AdminPage topbar={topbar}>
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
    </AdminPage>
  );
}
