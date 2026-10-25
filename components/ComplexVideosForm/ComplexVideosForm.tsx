"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { ComplexTabForm } from "@/components/ComplexTabForm";
import { Field } from "@/components/Field";
import { Rule12Check } from "@/components/Rule12Check";
import type { VideosResult } from "@/lib/admin/complexes/types";
import { newVideoDraft, VIDEO_LIMITS, videoField, type VideoDraft, type VideoErrors, type VideoIssue } from "@/lib/admin/complexes/videos";
import type { FormAction } from "@/lib/admin/developers/types";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useState } from "react";
import { useTabSave } from "@/lib/ui/useTabSave";

type ComplexVideosFormProps = {
  complexId: string;
  videos: readonly VideoDraft[];
  action: FormAction<VideosResult>;
};

/** Вкладка «Видео» (ТЗ 7.5, Ф4): до шести роликов YouTube по порядку, первое — крупно на сайте. */
export function ComplexVideosForm({ complexId, videos, action }: ComplexVideosFormProps) {
  const t = useTranslations("admin.complexes");
  const save = useTabSave(action, t("unsaved"));
  const draft = useDraftRows(videos, { dirty: save.dirty, savedAt: save.savedAt, markDirty: save.onInput });
  const errors: VideoErrors = save.state.status === "error" ? save.state.errors : {};
  const move = (index: number, by: -1 | 1) =>
    draft.change((rows) => {
      const next = [...rows];
      [next[index], next[index + by]] = [next[index + by]!, next[index]!];
      return next;
    });
  const add = (
    <Button variant="ghost" size="sm" disabled={draft.rows.length >= VIDEO_LIMITS.maxRows} onClick={() => draft.change((rows) => [...rows, newVideoDraft()])}>
      + {t("videos.add")}
    </Button>
  );
  return (
    <ComplexTabForm title={t("videos.title")} lead={t("videos.lead")} complexId={complexId} save={save} extra={add}>
      {draft.rows.length === 0 ? <p className="complex-videos-form__empty">{t("videos.empty")}</p> : null}
      <ol className="complex-videos-form">
        {draft.rows.map((row, index) => (
          <VideoRow
            key={row.key}
            row={row}
            index={index}
            last={index === draft.rows.length - 1}
            errors={errors[row.key]}
            onMove={(by) => move(index, by)}
            onRemove={() => draft.remove(row.key)}
          />
        ))}
      </ol>
      {draft.rows.length > 0 ? <VideosRule12 savedAt={save.savedAt} /> : null}
    </ComplexTabForm>
  );
}

/** Отметка правила 1.2 — на одно сохранение: после «Сохранено» снимается, как у загрузки фото. */
function VideosRule12({ savedAt }: { savedAt: number | null }) {
  const [checked, setChecked] = useState(false);
  const [checkedAt, setCheckedAt] = useState(savedAt);
  // Только новое «Сохранено» снимает отметку; ошибка сохранения её оставляет.
  if (savedAt !== null && savedAt !== checkedAt) {
    setCheckedAt(savedAt);
    setChecked(false);
  }
  return (
    <>
      <Rule12Check id="complex-videos-rule12" checked={checked} onChange={setChecked} context="video" />
      <input type="hidden" name="rule12" value={checked ? "on" : ""} />
    </>
  );
}

type VideoRowProps = {
  row: VideoDraft;
  index: number;
  last: boolean;
  errors: VideoErrors[string] | undefined;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

/** Строка: ссылка YouTube, подпись RU | UZ (необязательно), порядок и корзина. */
function VideoRow({ row, index, last, errors, onMove, onRemove }: VideoRowProps) {
  const t = useTranslations("admin.complexes.videos");
  const issue = (code: VideoIssue | undefined) => (code ? t(`issues.${code}`) : undefined);
  return (
    <li className="complex-videos-form__row">
      <input type="hidden" name="videoKey" value={row.key} />
      <span className="complex-videos-form__number">{index === 0 ? t("main") : index + 1}</span>
      <div className="complex-videos-form__fields">
        <Field
          id={`complex-${videoField(row.key, "link")}`}
          name={videoField(row.key, "link")}
          label={t("link")}
          hint={t("linkHint")}
          defaultValue={row.link}
          inputMode="url"
          autoComplete="off"
          error={issue(errors?.link)}
        />
        <BilingualField
          id={`complex-${videoField(row.key, "title")}`}
          name={videoField(row.key, "title")}
          label={t("videoTitle")}
          uzLabel={t("videoTitleUz")}
          maxLength={VIDEO_LIMITS.titleMax}
          defaultValue={row.title}
          error={issue(errors?.title)}
        />
      </div>
      <div className="complex-videos-form__tools">
        <button type="button" className="complex-videos-form__tool" aria-label={t("up")} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-videos-form__tool" aria-label={t("down")} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-videos-form__tool" aria-label={t("remove")} onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
