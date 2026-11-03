import { CheckCircle2, Clock, Hourglass, Undo2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AdminPanel } from "@/components/AdminPanel";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { formatStatsCount, waitParts } from "@/lib/stats/numbers";
import type { ProgressStats, ProgressStatsComplex } from "@/lib/stats/types";
import { formatDate, formatMonthYear } from "@vh/shared/format";

/**
 * «Ход стройки» (фаза F, п. 41): опубликовано и возвращено отчётов за период, среднее ожидание
 * проверки, очередь сейчас и ЖК без отчёта за месяц конца периода. null — не прочитался: своя
 * строка, статистика сайта остаётся.
 */
export async function StatsProgress({ progress }: { progress: ProgressStats | null }) {
  const t = await getTranslations("admin.stats.progress");
  return (
    <AdminPanel title={t("title")} wide>
      {progress ? (
        <>
          <ProgressKpis progress={progress} />
          <p className="stats-progress__note">{t("waitNote")}</p>
          <WithoutReport progress={progress} />
        </>
      ) : (
        <p className="stats-screen__empty">{t("unavailable")}</p>
      )}
    </AdminPanel>
  );
}

type ProgressT = Awaited<ReturnType<typeof getTranslations<"admin.stats.progress">>>;

/** Опубликовано · возвратов · среднее ожидание · ждут сейчас — карточками, как цифры сайта. */
async function ProgressKpis({ progress }: { progress: ProgressStats }) {
  const t = await getTranslations("admin.stats.progress");
  return (
    <ul className="stats-screen__kpis stats-progress__kpis">
      {progressTiles(progress, t).map(([key, Icon, value, sub]) => (
        <li key={key} className="stats-screen__kpi">
          <span className="stats-screen__kpi-label">
            <Icon size={14} aria-hidden="true" />
            {t(key)}
          </span>
          <b className="stats-screen__kpi-value">{value}</b>
          {sub ? <span className="stats-screen__kpi-delta">{sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Карточка: подпись, значок, число и строка под ним. */
function progressTiles(progress: ProgressStats, t: ProgressT) {
  const wait = (hours: number | null) => {
    const parts = waitParts(hours);
    return parts ? t("waitValue", parts) : "—";
  };
  const { published, unit_published: units, returned, waiting_now: waiting } = progress;
  return [
    [
      "published",
      CheckCircle2,
      formatStatsCount(published),
      units > 0 ? t("publishedUnits", { count: units }) : null,
    ],
    [
      "returned",
      Undo2,
      formatStatsCount(returned),
      returned > 0 ? t("returnedReports", { count: progress.returned_reports }) : null,
    ],
    [
      "wait",
      Hourglass,
      wait(progress.wait_avg_hours),
      progress.wait_count > 0
        ? t("waitMax", { value: wait(progress.wait_max_hours) })
        : t("waitNone"),
    ],
    [
      "waitingNow",
      Clock,
      formatStatsCount(waiting),
      waiting > 0 ? t("waitMax", { value: wait(progress.oldest_wait_hours) }) : t("queueEmpty"),
    ],
  ] as const;
}

async function WithoutReport({ progress }: { progress: ProgressStats }) {
  const t = await getTranslations("admin.stats.progress");
  // «за ноябрь 2026» — месяц в середине фразы со строчной.
  const month = formatMonthYear(progress.month).toLowerCase();
  const rows = progress.complexes_without;
  return (
    <div className="stats-progress__without">
      <h3 className="stats-progress__title">
        {t("withoutTitle", { month })}
        {progress.month_open ? (
          <span className="stats-progress__open"> · {t("monthOpen")}</span>
        ) : null}
      </h3>
      {rows.length === 0 ? (
        <p className="stats-screen__empty">
          {progress.complexes_building > 0
            ? t("withoutAll", { count: progress.complexes_building, month })
            : t("withoutNone")}
        </p>
      ) : (
        <div className="stats-table">
          <table className="stats-table__table">
            <thead>
              <tr>
                <th scope="col">{t("complex")}</th>
                <th scope="col">{t("blocks")}</th>
                <th scope="col">{t("last")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <WithoutRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="stats-progress__more">
        <Link className="stats-table__link" href={ADMIN_ROUTES.video}>
          {t("open")}
        </Link>
      </p>
    </div>
  );
}

async function WithoutRow({ row }: { row: ProgressStatsComplex }) {
  const t = await getTranslations("admin.stats.progress");
  const last = row.last_published_at ? new Date(row.last_published_at) : null;
  return (
    <tr>
      <td>
        {row.name.ru}
        {row.status !== "published" ? (
          <span className="stats-table__sub">{t(`complexStatus.${row.status}`)}</span>
        ) : null}
      </td>
      <td>
        <span className="stats-table__sub">
          {t("blocksDone", { done: row.blocks_done, total: row.blocks_total })}
        </span>
        {row.missing
          .map((block) =>
            block.state === "returned" ? t("blockReturned", { name: block.name }) : block.name,
          )
          .join(", ")}
      </td>
      <td>
        {last ? formatDate(last) : t("lastNever")}
        {row.late ? <span className="stats-progress__late">{t("late")}</span> : null}
      </td>
    </tr>
  );
}
