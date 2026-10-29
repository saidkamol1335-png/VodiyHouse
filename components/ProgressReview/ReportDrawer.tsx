"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/Badge";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { ReportDetail } from "@/lib/admin/progress/types";
import { formatDateTime, formatMonthYear } from "@/lib/format";
import { mediaPublicUrl, progressVideoPublicUrl } from "@/lib/media";
import { ReviewDecision } from "./ReviewDecision";

type ReportDrawerProps = {
  report: ReportDetail;
  /** Менеджер и руководитель решают («Опубликовать», «Вернуть»), видеограф — только смотрит. */
  canReview: boolean;
};

const STATUS_TONE = { review: "amber", returned: "bad", published: "ok" } as const;

/**
 * Ящик отчёта (фаза 5, мокап CabReview .drw): крошка «ЖК · Блок · кв.», «Ход строительства · Октябрь
 * 2026» или «Видео квартиры · …», кто и когда снял, видео, комментарий RU и UZ, фото; внизу — решение.
 * Закрытие — обратно на экран без ?report.
 */
export function ReportDrawer({ report, canReview }: ReportDrawerProps) {
  const t = useTranslations("admin.video");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  const close = () => router.replace(ADMIN_ROUTES.video, { scroll: false });
  return (
    <dialog
      ref={dialog}
      className="progress-review__drawer"
      aria-labelledby="progress-report-title"
      onClose={close}
    >
      <DrawerHead report={report} onClose={() => dialog.current?.close()} />
      <div className="progress-review__body">
        <ReportMedia report={report} />
        <dl className="progress-review__comment">
          <dt>{t("form.commentRu")} · RU</dt>
          <dd>{report.comment.ru}</dd>
          <dt>{t("form.commentUz")} · UZ</dt>
          <dd>{report.comment.uz}</dd>
        </dl>
      </div>
      <ReportFooter report={report} canReview={canReview} onDone={close} />
    </dialog>
  );
}

/** Шапка ящика: «ЖК · Блок · кв.», заголовок, кто и когда снял, статус, «×». */
function DrawerHead({ report, onClose }: { report: ReportDetail; onClose: () => void }) {
  const t = useTranslations("admin.video");
  const unit = report.unitNumber ? t("review.unit", { number: report.unitNumber }) : null;
  const crumb = [report.complexName, t("form.blockOption", { name: report.blockName }), unit]
    .filter(Boolean)
    .join(" · ");
  const title = t(report.isUnit ? "review.unitTitle" : "review.blockTitle", {
    month: formatMonthYear(report.month),
  });
  const by = t("review.by", {
    author: report.author ?? t("review.noAuthor"),
    at: formatDateTime(new Date(report.createdAt)),
  });
  return (
    <header className="progress-review__head">
      <p className="progress-review__crumb">{crumb}</p>
      <h3 id="progress-report-title" className="progress-review__heading">
        {title}
      </h3>
      <p className="progress-review__by">{by}</p>
      <Badge tone={STATUS_TONE[report.status]} size="sm" dot>
        {t(`mine.status.${report.status}`)}
      </Badge>
      <button
        type="button"
        className="progress-review__close"
        aria-label={t("review.close")}
        onClick={onClose}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  );
}

function ReportFooter({ report, canReview, onDone }: ReportDrawerProps & { onDone: () => void }) {
  const t = useTranslations("admin.video.review");
  if (report.status === "review" && canReview)
    return <ReviewDecision id={report.id} onDone={onDone} />;
  if (report.status === "review") return <p className="progress-review__notice">{t("waiting")}</p>;
  if (report.status === "returned")
    return (
      <p className="progress-review__notice">
        {t("returnedNote", { note: report.returnNote ?? "" })}
      </p>
    );
  return (
    <p className="progress-review__notice progress-review__notice--ok">
      <Check size={16} aria-hidden="true" />
      {t(report.isUnit ? "publishedUnit" : "published")}
    </p>
  );
}

/** Видео (YouTube — ссылкой на ролик, файл — плеером) и фото отчёта сеткой. */
function ReportMedia({ report }: { report: ReportDetail }) {
  const t = useTranslations("admin.video.review");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return (
    <>
      {report.videoPath ? (
        <video
          className="progress-review__video"
          src={progressVideoPublicUrl(supabaseUrl, report.videoPath)}
          controls
          preload="metadata"
        />
      ) : null}
      {report.youtubeId ? (
        <a
          className="progress-review__youtube"
          href={`https://youtu.be/${report.youtubeId}`}
          target="_blank"
          rel="noreferrer"
        >
          {t("youtube")}
        </a>
      ) : null}
      <p className="progress-review__label">{t("photos", { n: report.photos.length })}</p>
      <ul className="progress-review__photos">
        {report.photos.map((photo, index) => (
          <li key={photo.path}>
            <a
              href={mediaPublicUrl(supabaseUrl, photo.path)}
              target="_blank"
              rel="noreferrer"
              aria-label={t("photo", { n: index + 1 })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- фото отчёта из бакета: проверка 1.2 */}
              <img src={mediaPublicUrl(supabaseUrl, photo.path)} alt="" loading="lazy" />
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
