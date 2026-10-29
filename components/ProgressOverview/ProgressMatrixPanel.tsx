import { Bell } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge } from "@/components/Badge";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { MatrixCell, ProgressMatrix } from "@/lib/admin/progress/types";
import { formatMonthShort } from "@/lib/format";

type PanelProps = {
  matrix: ProgressMatrix;
  /** Ячейка открывает ящик отчёта (?report=<id>) — у менеджера и руководителя; видеографу чужие отчёты не открываются. */
  linked: boolean;
};

/**
 * «Отчёты по ЖК · последние 6 месяцев» (фаза 5, мокап CabReview): строка — ЖК, ячейка — отчёт блока за
 * месяц; «45+ дн.» и напоминание над панелью — у ЖК, где последний опубликованный отчёт старше 45 дней.
 */
export async function ProgressMatrixPanel({ matrix, linked }: PanelProps) {
  const t = await getTranslations("admin.video.matrix");
  if (matrix.rows.length === 0) return null;
  return (
    <>
      {matrix.late > 0 ? (
        <p className="progress-overview__late" role="status">
          <Bell size={16} aria-hidden="true" />
          {t("late", { n: matrix.late })}
        </p>
      ) : null}
      <AdminPanel title={t("title")} wide>
        <div className="progress-overview__head">
          {linked ? <p className="admin-panel__lead">{t("hint")}</p> : <span />}
          <Legend />
        </div>
        <div className="progress-overview__scroll">
          <MatrixTable matrix={matrix} linked={linked} />
        </div>
      </AdminPanel>
    </>
  );
}

async function MatrixTable({ matrix, linked }: PanelProps) {
  const t = await getTranslations("admin.video.matrix");
  return (
    <div className="progress-overview__matrix" role="table" aria-label={t("title")}>
      <div className="progress-overview__row" role="row">
        <span role="columnheader" />
        {matrix.months.map((month, index) => (
          <span key={month} className="progress-overview__month" role="columnheader">
            {formatMonthShort(month, index === 0)}
          </span>
        ))}
      </div>
      {matrix.rows.map((row) => (
        <div key={row.complexId} className="progress-overview__row" role="row">
          <span className="progress-overview__name" role="rowheader">
            {row.name}
            {row.late ? (
              <Badge tone="bad" size="sm">
                {t("lateBadge")}
              </Badge>
            ) : null}
          </span>
          {row.cells.map((cell, index) => (
            <span key={matrix.months[index]} role="cell">
              <Cell cell={cell} linked={linked} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

async function Legend() {
  const t = await getTranslations("admin.video.matrix.legend");
  return (
    <p className="progress-overview__legend">
      {(["published", "review", "none"] as const).map((kind) => (
        <span key={kind}>
          <i className={`progress-overview__sw progress-overview__sw--${kind}`} />
          {t(kind)}
        </span>
      ))}
    </p>
  );
}

async function Cell({ cell, linked }: { cell: MatrixCell; linked: boolean }) {
  const t = await getTranslations("admin.video.matrix.cell");
  const className = `progress-overview__cell progress-overview__cell--${cell.kind}`;
  const label = cell.kind === "published" ? cell.date : t(cell.kind);
  const title =
    cell.kind === "published" ? t("publishedTitle", { date: cell.date }) : t(`${cell.kind}Title`);
  if (linked && "reportId" in cell) {
    return (
      <Link
        className={className}
        href={`${ADMIN_ROUTES.video}?report=${cell.reportId}`}
        title={title}
        scroll={false}
      >
        {label}
      </Link>
    );
  }
  return (
    <span className={className} title={title}>
      {label}
    </span>
  );
}
