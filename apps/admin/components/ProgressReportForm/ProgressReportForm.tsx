"use client";

import { Save, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import type { StaffRole } from "@/lib/admin/access";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { PHONE_VIDEO_UPLOAD, type ProgressEdit, type ProgressFormComplex } from "@/lib/admin/progress/types";
import { ReportPhotos } from "./ReportPhotos";
import { ReportTarget } from "./ReportTarget";
import { ReportVideo } from "./ReportVideo";
import { useReportForm, type ReportStart } from "./useReportForm";

type ProgressReportFormProps = {
  complexes: readonly ProgressFormComplex[];
  /** Окно даты съёмки по Ташкенту (сервер): max — сегодня. */
  shotBounds: { min: string; max: string };
  userId: string;
  role: StaffRole;
  /** Черновик или возвращённый отчёт (?id=): форма заполнена им, ЖК не меняется. */
  edit?: ProgressEdit | null;
  /** «Снять отчёт» из «Заданий»: ЖК и блок выбраны. */
  start?: ReportStart;
};

const COMMENT_MAX = 300;
const NO_START: ReportStart = { complexId: null, blockId: null };

/**
 * «Новый отчёт» (фаза 5, мокап CabVideo; фаза E, пп. 31–33, 37): ЖК, дата съёмки, блок, квартира; видео;
 * 3–15 фото (камерой или из галереи, сразу в incoming); комментарий RU и UZ; «Сохранить черновик» и «На
 * проверку». Черновик и возвращённый отчёт — та же форма, заполненная им.
 */
export function ProgressReportForm(props: ProgressReportFormProps) {
  const { complexes, shotBounds, userId, role, edit = null, start = NO_START } = props;
  const t = useTranslations("admin.video.form");
  const state = useReportForm(complexes, shotBounds.max, { userId, role }, edit, start);
  const { form, target, change, queue, video, issueText, failure, notice, pending, mode, submit } = state;
  if (complexes.length === 0) return <AdminPanel title={t("title")}>{t("noComplexes")}</AdminPanel>;
  const title = edit?.status === "returned" ? t("fixTitle") : state.id ? t("editTitle") : t("title");
  return (
    <AdminPanel title={title} wide>
      <form ref={form} className="progress-form" onSubmit={submit} noValidate>
        {edit?.status === "returned" && edit.returnNote ? (
          <FormStatus tone="notice">{t("fixNote", { note: edit.returnNote })}</FormStatus>
        ) : null}
        <ReportTarget
          complexes={complexes}
          shotBounds={shotBounds}
          keepShot={edit?.status === "returned" ? edit.shotOn : null}
          value={target}
          onChange={change}
          lockComplex={Boolean(edit || state.id)}
        />
        {issueText("shot") ? <p className="progress-form__error" role="alert">{issueText("shot")}</p> : null}
        <ReportPhotos tiles={queue.tiles} onAdd={queue.add} onRemove={queue.remove} error={issueText("photos") ?? null} />
        {PHONE_VIDEO_UPLOAD || video.state.status !== "idle" ? (
          <ReportVideo video={video.state} onPick={video.pick} onRemove={video.remove} />
        ) : null}
        {issueText("video") ? <p className="progress-form__error" role="alert">{issueText("video")}</p> : null}
        <YoutubeField initial={edit?.youtubeId ?? ""} />
        <CommentField error={issueText("comment")} initial={edit?.comment} />
        {failure ? <FormStatus tone="error">{failure}</FormStatus> : null}
        {notice ? <FormStatus tone={notice === "draftSaved" ? "success" : "notice"}>{t(notice)}</FormStatus> : null}
        <FormActions pending={pending} mode={mode} back={Boolean(edit)} />
      </form>
    </AdminPanel>
  );
}

/** Ссылка на ролик или Shorts YouTube — для длинных видео (файл — до 50 МБ). */
function YoutubeField({ initial }: { initial: string }) {
  const t = useTranslations("admin.video.form");
  return (
    <Field
      id="progress-youtube"
      name="youtube"
      label={PHONE_VIDEO_UPLOAD ? t("youtube") : t("youtubeOnly")}
      placeholder={PHONE_VIDEO_UPLOAD ? t("youtubePlaceholder") : t("youtubeOnlyPlaceholder")}
      maxLength={120}
      inputMode="url"
      defaultValue={initial ? `https://youtu.be/${initial}` : undefined}
    />
  );
}

/** Комментарий RU | UZ (мокап: «Комментарий · RU», «Izoh · UZ», до 300 знаков). */
function CommentField({ error, initial }: { error: string | undefined; initial?: { ru: string; uz: string } }) {
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

/** «На проверку» и «Сохранить черновик»; у правки ещё «Назад к отчётам». На телефоне — липкая полоса. */
function FormActions({ pending, mode, back }: { pending: boolean; mode: "draft" | "submit"; back: boolean }) {
  const t = useTranslations("admin.video.form");
  return (
    <div className="progress-form__actions">
      <Button type="submit" name="intent" value="submit" block pending={pending && mode === "submit"}>
        <Send size={18} aria-hidden="true" />
        {pending && mode === "submit" ? t("sending") : t("submit")}
      </Button>
      <Button type="submit" name="intent" value="draft" variant="outline" block pending={pending && mode === "draft"}>
        <Save size={18} aria-hidden="true" />
        {pending && mode === "draft" ? t("draftSaving") : t("draft")}
      </Button>
      {back ? (
        <Button href={ADMIN_ROUTES.videoMine} variant="ghost" block>
          {t("cancelFix")}
        </Button>
      ) : null}
    </div>
  );
}
