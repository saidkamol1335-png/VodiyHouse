"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import type { ProgressFormComplex } from "@/lib/admin/progress/types";
import { ReportPhotos } from "./ReportPhotos";
import { ReportTarget } from "./ReportTarget";
import { ReportVideo } from "./ReportVideo";
import { useReportForm } from "./useReportForm";

type ProgressReportFormProps = {
  complexes: readonly ProgressFormComplex[];
  /** Текущий и прошлый месяц по Ташкенту (сервер), «2026-10-01». */
  months: readonly [string, string];
};

const COMMENT_MAX = 300;

/**
 * «Новый отчёт» (фаза 5, мокап CabVideo): ЖК, месяц, блок, квартира; видео; 3–15 фото; комментарий
 * RU и UZ; «Отправить на проверку». Фото грузятся сразу при выборе — к отправке они уже в бакете.
 */
export function ProgressReportForm({ complexes, months }: ProgressReportFormProps) {
  const t = useTranslations("admin.video.form");
  const { form, round, target, change, queue, video, issues, sent, pending, submit } =
    useReportForm(complexes, months);
  if (complexes.length === 0) return <AdminPanel title={t("title")}>{t("noComplexes")}</AdminPanel>;
  return (
    <AdminPanel title={t("title")} wide>
      <form ref={form} className="progress-form" onSubmit={submit} noValidate>
        <ReportTarget complexes={complexes} months={months} value={target} onChange={change} />
        <ReportVideo video={video.state} onPick={video.pick} onRemove={video.remove} />
        {issues.video ? (
          <p className="progress-form__error" role="alert">
            {issues.video}
          </p>
        ) : null}
        <Field
          key={`youtube-${round}`}
          id="progress-youtube"
          name="youtube"
          label={t("youtube")}
          placeholder={t("youtubePlaceholder")}
          maxLength={120}
          inputMode="url"
        />
        <ReportPhotos
          tiles={queue.tiles}
          onAdd={queue.add}
          onRemove={queue.remove}
          error={issues.photos ?? null}
        />
        <CommentField key={`comment-${round}`} error={issues.comment} />
        {issues.form ? <FormStatus tone="error">{issues.form}</FormStatus> : null}
        {sent ? <FormStatus tone="success">{t("sent")}</FormStatus> : null}
        <Button type="submit" block pending={pending} className="progress-form__submit">
          <Send size={18} aria-hidden="true" />
          {pending ? t("sending") : t("submit")}
        </Button>
      </form>
    </AdminPanel>
  );
}

/** Комментарий RU | UZ (мокап: «Комментарий · RU», «Izoh · UZ», до 300 знаков). */
function CommentField({ error }: { error: string | undefined }) {
  const t = useTranslations("admin.video.form");
  return (
    <BilingualField
      id="progress-comment"
      name="comment"
      label={t("commentRu")}
      uzLabel={t("commentUz")}
      multiline
      maxLength={COMMENT_MAX}
      placeholder={{ ru: t("commentRuPlaceholder"), uz: t("commentUzPlaceholder") }}
      error={error}
    />
  );
}
