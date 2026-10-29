import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge, type BadgeTone } from "@/components/Badge";
import { LeadWhen } from "@/components/LeadWhen";
import type { MyProgressReport, ProgressReportStatus } from "@/lib/admin/progress/types";
import { formatMonthYear } from "@/lib/format";
import { mediaPublicUrl } from "@/lib/media";

const STATUS_TONE: Record<ProgressReportStatus, BadgeTone> = {
  review: "amber",
  returned: "bad",
  published: "ok",
};

/** «Как снимать» (мокап CabVideo): пять пунктов по порядку. */
const HOW_TO = ["month", "plan", "unit", "rule12", "youtube"] as const;

type VideoScreenProps = {
  /** «Новый отчёт» (клиентская форма). */
  form: ReactNode;
  mine: readonly MyProgressReport[];
};

/**
 * Экран видеографа (фаза 5, мокап CabVideo .grid-main 1.6fr / 1fr): слева «Новый отчёт», справа «Как
 * снимать» и «Мои отчёты»; до 1180 px — колонкой. Матрица и «Видео для клиентов» — в 5D.
 */
export async function VideoScreen({ form, mine }: VideoScreenProps) {
  const t = await getTranslations("admin.video");
  return (
    <div className="video-screen">
      <div className="video-screen__main">{form}</div>
      <div className="video-screen__side">
        <AdminPanel title={t("howTo.title")}>
          <ul className="video-screen__howto">
            {HOW_TO.map((key) => (
              <li key={key}>
                <Check size={16} aria-hidden="true" />
                {t(`howTo.items.${key}`)}
              </li>
            ))}
          </ul>
        </AdminPanel>
        <AdminPanel title={t("mine.title")}>
          {mine.length === 0 ? (
            <p className="video-screen__empty">{t("mine.empty")}</p>
          ) : (
            <MineList reports={mine} />
          )}
        </AdminPanel>
      </div>
    </div>
  );
}

async function MineList({ reports }: { reports: readonly MyProgressReport[] }) {
  const t = await getTranslations("admin.video.mine");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return (
    <ul className="video-screen__mine">
      {reports.map((report) => (
        <li key={report.id} className="video-screen__report">
          {report.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- миниатюра 64 × 44 из бакета в кабинете
            <img
              className="video-screen__thumb"
              src={mediaPublicUrl(supabaseUrl, report.thumb)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="video-screen__thumb" />
          )}
          <div className="video-screen__report-text">
            <p className="video-screen__report-title">
              {t("item", {
                complex: report.complexName,
                block: report.blockName,
                unit: report.unitNumber ? t("unit", { number: report.unitNumber }) : "",
                month: formatMonthYear(report.month),
              })}
            </p>
            <p className="video-screen__report-when">
              <LeadWhen at={report.createdAt} />
            </p>
            {report.status === "returned" && report.returnNote ? (
              <p className="video-screen__report-note">
                {t("returnNote", { note: report.returnNote })}
              </p>
            ) : null}
          </div>
          <Badge tone={STATUS_TONE[report.status]} size="sm" dot className="video-screen__status">
            {t(`status.${report.status}`)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
