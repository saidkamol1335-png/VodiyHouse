import { redirect } from "next/navigation";
import { ReviewScreen } from "@/components/ProgressReview";
import { ProgressTasks } from "@/components/ProgressTasks";
import { VideoLayout } from "@/components/VideoLayout";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { idParam } from "@/lib/admin/progress/params";
import { readProgressTasks } from "@/lib/admin/server/progressScreens";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Задания» мобилографа на текущий месяц (п. 34). */
async function Tasks() {
  const tasks = await readProgressTasks(await createSupabaseServerClient());
  return tasks ? <ProgressTasks tasks={tasks} /> : null;
}

/**
 * «Видео и ход стройки» (фаза 5; Проект-2, фаза E, пп. 34, 38): мобилограф — «Задания», руководитель и
 * менеджер — «Проверка» (очередь, матрица, видео для клиентов, ящик ?report; решает руководитель).
 * Старая ссылка «Исправить» (?fix=) — в форму отчёта.
 */
export default async function VideoPage({ searchParams }: PageProps<"/video">) {
  const search = await searchParams;
  const fix = idParam(search.fix);
  if (fix) redirect(`${ADMIN_ROUTES.videoNew}?id=${fix}`);
  return (
    <VideoLayout tab="home">
      {(viewer) =>
        viewer.role === "mobilographer" ? (
          <Tasks />
        ) : (
          <ReviewScreen role={viewer.role} reportId={idParam(search.report)} />
        )
      }
    </VideoLayout>
  );
}
