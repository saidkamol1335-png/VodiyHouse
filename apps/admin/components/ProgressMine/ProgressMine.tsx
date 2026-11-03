import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { MyProgressReport, ProgressReportStatus } from "@/lib/admin/progress/types";
import { formatDate } from "@vh/shared/format";
import { DeleteReport } from "./DeleteReport";

const STATUS_TONE: Record<ProgressReportStatus, BadgeTone> = {
  draft: "neutral",
  review: "amber",
  returned: "bad",
  published: "ok",
};

export const MINE_FILTERS = ["all", "draft", "review", "returned", "published"] as const;
export type MineFilter = (typeof MINE_FILTERS)[number];

export const isMineFilter = (value: unknown): value is MineFilter =>
  MINE_FILTERS.includes(value as MineFilter);

type ProgressMineProps = {
  items: readonly MyProgressReport[];
  filter: MineFilter;
  /** Сверху — итог отправки и «Уведомления в Telegram» мобилографа. */
  top?: ReactNode;
};

const shotDate = (iso: string) => formatDate(new Date(`${iso}T12:00:00`));

/**
 * «Мои отчёты» (фаза E): только свои отчёты, фильтр по статусу. Черновик — «Продолжить» и «Удалить»;
 * возвращённый — причина, «Исправить» и «Удалить»; на проверке и опубликованный — «Открыть» (ящик).
 */
export async function ProgressMine({ items, filter, top }: ProgressMineProps) {
  const t = await getTranslations("admin.video.mine");
  return (
    <div className="progress-mine">
      {top}
      <AdminPanel title={t("title")} wide>
        {/* form — подписи переносятся строкой ниже: на телефоне пять вариантов не помещаются в ряд. */}
        <Segmented label={t("filter.label")} form>
          {MINE_FILTERS.map((key) => (
            <Link
              key={key}
              href={mineHref(key)}
              className={segmentedItemClass(key === filter)}
              aria-current={key === filter ? "page" : undefined}
            >
              {t(`filter.${key}`)}
            </Link>
          ))}
        </Segmented>
        {items.length === 0 ? (
          <p className="progress-mine__empty">{filter === "all" ? t("empty") : t("emptyFilter")}</p>
        ) : (
          <ul className="progress-mine__list">
            {items.map((report) => (
              <MineRow key={report.id} report={report} filter={filter} />
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}

/** Адрес «Моих отчётов» с фильтром — ящик открывается и закрывается, не сбрасывая его. */
export const mineHref = (filter: MineFilter, report?: string) => {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (report) params.set("report", report);
  const query = params.toString();
  return query ? `${ADMIN_ROUTES.videoMine}?${query}` : ADMIN_ROUTES.videoMine;
};

async function MineRow({ report, filter }: { report: MyProgressReport; filter: MineFilter }) {
  const t = await getTranslations("admin.video.mine");
  const unit = report.unitNumber ? t("unit", { number: report.unitNumber }) : "";
  return (
    <li className="progress-mine__item">
      {report.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- миниатюра 64 × 44, адрес подписал сервер
        <img className="progress-mine__thumb" src={report.thumbUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="progress-mine__thumb" />
      )}
      <div className="progress-mine__text">
        <p className="progress-mine__title">
          {t("item", { complex: report.complexName, block: report.blockName, unit })}
        </p>
        <p className="progress-mine__when">{t("shot", { date: shotDate(report.shotOn), photos: report.photos })}</p>
        {report.status === "returned" && report.returnNote ? (
          <p className="progress-mine__note">{t("returnNote", { note: report.returnNote })}</p>
        ) : null}
      </div>
      <Badge tone={STATUS_TONE[report.status]} size="sm" dot className="progress-mine__status">
        {t(`status.${report.status}`)}
      </Badge>
      <MineActions report={report} filter={filter} />
    </li>
  );
}

async function MineActions({ report, filter }: { report: MyProgressReport; filter: MineFilter }) {
  const t = await getTranslations("admin.video.mine");
  if (report.status === "draft" || report.status === "returned") {
    return (
      <div className="progress-mine__actions">
        <Button href={`${ADMIN_ROUTES.videoNew}?id=${report.id}`} size="sm">
          {t(report.status === "draft" ? "continue" : "fix")}
        </Button>
        <DeleteReport id={report.id} returned={report.status === "returned"} />
      </div>
    );
  }
  return (
    <div className="progress-mine__actions">
      <Button href={mineHref(filter, report.id)} variant="outline" size="sm">
        {t("open")}
      </Button>
    </div>
  );
}
