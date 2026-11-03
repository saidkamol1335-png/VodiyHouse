import { Camera, PencilLine, RotateCcw } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { ProgressTasks as Tasks, TaskBlock, TaskStatus } from "@/lib/admin/progress/types";
import { formatDate, formatMonthYear } from "@vh/shared/format";

const TONE: Record<TaskStatus, BadgeTone> = {
  none: "line",
  draft: "neutral",
  review: "amber",
  returned: "bad",
  published: "ok",
};

/**
 * «Задания» мобилографа (фаза E, п. 34): строящиеся ЖК и блоки с отметкой текущего месяца, «Осталось N
 * из M». Нет отчёта — «Снять отчёт» (форма с ЖК и блоком); свой черновик — «Продолжить», свой
 * возвращённый — «Исправить». Сданные блоки не показываются.
 */
export async function ProgressTasks({ tasks }: { tasks: Tasks }) {
  const t = await getTranslations("admin.video.tasks");
  const title = t("title", { month: formatMonthYear(tasks.month) });
  if (tasks.complexes.length === 0) return <AdminPanel title={title}>{t("empty")}</AdminPanel>;
  const done = tasks.total - tasks.left;
  return (
    <AdminPanel title={title} wide>
      <div className="progress-tasks">
        <div className="progress-tasks__meter">
          <p className="progress-tasks__left">
            {tasks.left === 0 ? t("done") : t("left", { left: tasks.left, total: tasks.total })}
          </p>
          <span
            className="progress-tasks__bar"
            role="progressbar"
            aria-label={t("left", { left: tasks.left, total: tasks.total })}
            aria-valuemin={0} aria-valuemax={tasks.total} aria-valuenow={done}>
            <span style={{ transform: `scaleX(${tasks.total ? done / tasks.total : 1})` }} />
          </span>
        </div>
        {tasks.complexes.map((complex) => (
          <section key={complex.id} className="progress-tasks__complex" aria-labelledby={`task-${complex.id}`}>
            <h3 id={`task-${complex.id}`} className="progress-tasks__name">
              {complex.name}
              <span className="progress-tasks__count">
                {complex.total - complex.left}/{complex.total}
              </span>
            </h3>
            <ul className="progress-tasks__blocks">
              {complex.blocks.map((block) => (
                <TaskRow key={block.id} complexId={complex.id} block={block} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AdminPanel>
  );
}

async function TaskRow({ complexId, block }: { complexId: string; block: TaskBlock }) {
  const t = await getTranslations("admin.video.tasks");
  return (
    <li className={`progress-tasks__block progress-tasks__block--${block.status}`}>
      <div className="progress-tasks__text">
        <span className="progress-tasks__block-name">{t("block", { name: block.name })}</span>
        {block.shotOn && block.status !== "none" ? (
          <span className="progress-tasks__shot">{t("shot", { date: formatDate(new Date(`${block.shotOn}T12:00:00`)) })}</span>
        ) : null}
      </div>
      <Badge tone={TONE[block.status]} size="sm" dot className="progress-tasks__status">
        {t(`status.${block.status}`)}
      </Badge>
      <TaskAction complexId={complexId} block={block} />
    </li>
  );
}

async function TaskAction({ complexId, block }: { complexId: string; block: TaskBlock }) {
  const t = await getTranslations("admin.video.tasks");
  if (block.status === "none") {
    return (
      <Button href={`${ADMIN_ROUTES.videoNew}?complex=${complexId}&block=${block.id}`} size="sm" className="progress-tasks__action">
        <Camera size={16} aria-hidden="true" />
        {t("shoot")}
      </Button>
    );
  }
  // Возвращённый отчёт коллеги исправляет он сам: здесь — только подпись.
  if (!block.mine || !block.reportId) {
    return <span className="progress-tasks__action progress-tasks__muted">{block.status === "returned" ? t("others") : null}</span>;
  }
  if (block.status === "draft" || block.status === "returned") {
    const Icon = block.status === "draft" ? PencilLine : RotateCcw;
    return (
      <Button href={`${ADMIN_ROUTES.videoNew}?id=${block.reportId}`} variant="outline" size="sm" className="progress-tasks__action">
        <Icon size={16} aria-hidden="true" />
        {t(block.status === "draft" ? "continue" : "fix")}
      </Button>
    );
  }
  return <span className="progress-tasks__action" />;
}
