"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { ProgressFix, ProgressFormComplex } from "@/lib/admin/progress/types";
import { ReportPhotos } from "./ReportPhotos";
import { ReportTarget } from "./ReportTarget";
import { ReportVideo } from "./ReportVideo";
import { useReportForm } from "./useReportForm";

type ProgressReportFormProps = {
  complexes: readonly ProgressFormComplex[];
  /** Текущий и прошлый месяц по Ташкенту (сервер), «2026-10-01»; у исправления — и его месяц. */
  months: readonly string[];
  /** Возвращённый отчёт: форма заполнена им, ЖК не меняется. */
  fix?: ProgressFix | null;
};

const COMMENT_MAX = 300;

/**
 * «Новый отчёт» (фаза 5, мокап CabVideo): ЖК, месяц, блок, квартира; видео; 3–15 фото; комментарий
 * RU и UZ; «Отправить на проверку». Фото грузятся сразу при выборе — к отправке они уже в бакете.
 * «Исправить отчёт» — та же форма, заполненная возвращённым отчётом, с причиной возврата сверху.
 */
export function ProgressReportForm({ complexes, months, fix = null }: ProgressReportFormProps) {
  const t = useTranslations("admin.video.form");
  const state = useReportForm(complexes, months, fix);
  const { form, round, target, change, queue, video, issues, sent, pending, submit } = state;
  if (complexes.length === 0) return <AdminPanel title={t("title")}>{t("noComplexes")}</AdminPanel>;
  return (
    <AdminPanel title={fix ? t("fixTitle") : t("title")} wide>
      <form ref={form} className="progress-form" onSubmit={submit} noValidate>
        {fix ? (
          <FormStatus tone="notice">{t("fixNote", { note: fix.returnNote })}</FormStatus>
        ) : null}
        <ReportTarget
          complexes={complexes}
          months={months}
          value={target}
          onChange={change}
          lockComplex={Boolean(fix)}
        />
        <ReportVideo video={video.state} onPick={video.pick} onRemove={video.remove} />
        {issues.video ? (
          <p className="progress-form__error" role="alert">
            {issues.video}
          </p>
        ) : null}
        <YoutubeField key={`youtube-${round}`} initial={fix?.youtubeId ?? ""} />
        <ReportPhotos
          tiles={queue.tiles}
          onAdd={queue.add}
          onRemove={queue.remove}
          error={issues.photos ?? null}
        />
        <CommentField key={`comment-${round}`} error={issues.comment} initial={fix?.comment} />
        {issues.form ? <FormStatus tone="error">{issues.form}</FormStatus> : null}
        {sent ? <FormStatus tone="success">{t("sent")}</FormStatus> : null}
        <FormActions pending={pending} fix={Boolean(fix)} />
      </form>
    </AdminPanel>
  );
}

/** «или ссылка YouTube · канал Vodiy House»; у исправления — ссылка отчёта. */
function YoutubeField({ initial }: { initial: string }) {
  const t = useTranslations("admin.video.form");
  return (
    <Field
      id="progress-youtube"
      name="youtube"
      label={t("youtube")}
      placeholder={t("youtubePlaceholder")}
      maxLength={120}
      inputMode="url"
      defaultValue={initial ? `https://youtu.be/${initial}` : undefined}
    />
  );
}

/** Комментарий RU | UZ (мокап: «Комментарий · RU», «Izoh · UZ», до 300 знаков). */
function CommentField({
  error,
  initial,
}: {
  error: string | undefined;
  initial?: { ru: string; uz: string };
}) {
  const t = useTranslations("admin.video.form");
  return (
    <BilingualField
      id="progress-comment"
      name="comment"
      label={t("commentRu")}
      uzLabel={t("commentUz")}
      multiline
      maxLength={COMMENT_MAX}
      defaultValue={initial}
      placeholder={{ ru: t("commentRuPlaceholder"), uz: t("commentUzPlaceholder") }}
      error={error}
    />
  );
}

/** «Отправить на проверку»; у исправления ещё «Отменить» — обратно к новому отчёту. */
function FormActions({ pending, fix }: { pending: boolean; fix: boolean }) {
  const t = useTranslations("admin.video.form");
  return (
    <>
      <Button type="submit" block pending={pending} className="progress-form__submit">
        <Send size={18} aria-hidden="true" />
        {pending ? t("sending") : t("submit")}
      </Button>
      {fix ? (
        <Button href={ADMIN_ROUTES.video} variant="ghost" block>
          {t("cancelFix")}
        </Button>
      ) : null}
    </>
  );
}
