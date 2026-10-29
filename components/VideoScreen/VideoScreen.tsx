import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LeadWhen } from "@/components/LeadWhen";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
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
            <ul className="video-screen__mine">
              {mine.map((report) => (
                <MineItem key={report.id} report={report} />
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}

/** Строка «Моих отчётов»: миниатюра 64 × 44, «ЖК · Блок · кв. · месяц», когда, статус; возвращённый — с причиной и «Исправить». */
async function MineItem({ report }: { report: MyProgressReport }) {
  const t = await getTranslations("admin.video.mine");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const unit = report.unitNumber ? t("unit", { number: report.unitNumber }) : "";
  return (
    <li className="video-screen__report">
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
            unit,
            month: formatMonthYear(report.month),
          })}
        </p>
        <p className="video-screen__report-when">
          <LeadWhen at={report.createdAt} />
        </p>
        {report.status === "returned" ? (
          <ReturnedHint id={report.id} note={report.returnNote} />
        ) : null}
      </div>
      <Badge tone={STATUS_TONE[report.status]} size="sm" dot className="video-screen__status">
        {t(`status.${report.status}`)}
      </Badge>
    </li>
  );
}

/** Возвращённый отчёт: «Что исправить: …» и «Исправить» — форма откроется заполненной (5B.4). */
async function ReturnedHint({ id, note }: { id: string; note: string | null }) {
  const t = await getTranslations("admin.video.mine");
  return (
    <>
      {note ? <p className="video-screen__report-note">{t("returnNote", { note })}</p> : null}
      <Button
        href={`${ADMIN_ROUTES.video}?fix=${id}`}
        variant="outline"
        size="sm"
        className="video-screen__fix"
      >
        {t("fix")}
      </Button>
    </>
  );
}
