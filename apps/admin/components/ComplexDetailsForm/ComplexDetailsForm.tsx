"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { ComplexTabForm } from "@/components/ComplexTabForm";
import { SelectField } from "@/components/SelectField";
import { DETAIL_LIMITS, detailField, newDetailDraft, type DetailDraft, type DetailTopic } from "@/lib/admin/complexes/details";
import type { PhotoItem } from "@/lib/admin/complexes/photos";
import type { DetailsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useTabSave } from "@/lib/ui/useTabSave";

type ComplexDetailsFormProps = {
  complexId: string;
  details: readonly DetailDraft[];
  topics: readonly DetailTopic[];
  /** Галерея ЖК: фото пункта выбирают из неё (база другое не примет). */
  photos: readonly Pick<PhotoItem, "id" | "src">[];
  action: FormAction<DetailsResult>;
};

/**
 * «Детали проекта» (ТЗ 7.7; правки 15.11, п. 22): пункты карусели на сайте в этом порядке — тема из
 * справочника (можно повторить: фасад, двор, лифт…), текст RU | UZ и фото из галереи; без фото — пункт
 * только текстом. Пустой пункт на сайт не попадает; без пунктов раздела нет.
 */
export function ComplexDetailsForm({ complexId, details, topics, photos, action }: ComplexDetailsFormProps) {
  const t = useTranslations("admin.complexes");
  const save = useTabSave(action, t("unsaved"));
  const draft = useDraftRows(details, { dirty: save.dirty, savedAt: save.savedAt, markDirty: save.onInput });
  const errors = save.state.status === "error" ? save.state.errors : {};
  const move = (index: number, by: -1 | 1) => draft.change((rows) => swapped(rows, index, index + by));
  const add = (
    <Button
      variant="ghost"
      size="sm"
      disabled={draft.rows.length >= DETAIL_LIMITS.maxRows || topics.length === 0}
      onClick={() => draft.change((rows) => [...rows, newDetailDraft()])}
    >
      + {t("details.add")}
    </Button>
  );
  return (
    <ComplexTabForm title={t("details.title")} lead={t("details.lead")} complexId={complexId} save={save} extra={add}>
      {topics.length === 0 ? <p className="complex-faq-form__empty">{t("details.empty")}</p> : null}
      {topics.length > 0 && draft.rows.length === 0 ? <p className="complex-faq-form__empty">{t("details.none")}</p> : null}
      <ol className="complex-faq-form">
        {draft.rows.map((row, index) => {
          const issue = errors[row.key];
          return (
            <DetailRow
              key={row.key}
              row={row}
              index={index}
              last={index === draft.rows.length - 1}
              topics={topics}
              photos={photos}
              error={issue ? t(`issues.${issue}`) : undefined}
              onMove={(by) => move(index, by)}
              onRemove={() => draft.remove(row.key)}
            />
          );
        })}
      </ol>
    </ComplexTabForm>
  );
}

/** Строки с переставленными соседями (стрелки «Выше» / «Ниже»). */
function swapped<T>(rows: readonly T[], from: number, to: number): T[] {
  const next = [...rows];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

type DetailRowProps = {
  row: DetailDraft;
  index: number;
  last: boolean;
  topics: ComplexDetailsFormProps["topics"];
  photos: ComplexDetailsFormProps["photos"];
  error: string | undefined;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

/** Пункт: тема, текст RU | UZ, фото; справа — порядок и корзина (как у «Частых вопросов»). */
function DetailRow({ row, index, last, topics, photos, error, onMove, onRemove }: DetailRowProps) {
  const t = useTranslations("admin.complexes.details");
  return (
    <li className="complex-faq-form__row" role="group" aria-label={t("row", { n: index + 1 })}>
      <input type="hidden" name="detailKey" value={row.key} />
      <input type="hidden" name={detailField(row.key, "id")} value={row.id ?? ""} />
      <span className="complex-faq-form__number">{index + 1}</span>
      <div className="complex-faq-form__fields">
        <SelectField
          id={`complex-${detailField(row.key, "topic")}`}
          name={detailField(row.key, "topic")}
          label={t("topic")}
          placeholder={t("topicPlaceholder")}
          defaultValue={row.topicId === null ? "" : String(row.topicId)}
          options={topics.map((topic) => ({ value: String(topic.id), label: topic.name.ru }))}
        />
        <BilingualField
          id={`complex-${detailField(row.key, "text")}`}
          name={detailField(row.key, "text")}
          label={t("text")}
          uzLabel={t("textUz")}
          maxLength={DETAIL_LIMITS.textMax}
          multiline
          defaultValue={row.text}
          error={error}
        />
        <PhotoChoice rowKey={row.key} photos={photos} selected={row.photoId} />
      </div>
      <div className="complex-faq-form__tools">
        <button type="button" className="complex-faq-form__tool" aria-label={t("up")} aria-disabled={index === 0} onClick={() => index > 0 && onMove(-1)}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-faq-form__tool" aria-label={t("down")} aria-disabled={last} onClick={() => !last && onMove(1)}>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-faq-form__tool" aria-label={t("remove")} onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

type PhotoChoiceProps = {
  rowKey: string;
  photos: ComplexDetailsFormProps["photos"];
  selected: string | null;
};

/** Фото пункта: «Без фото» или одно из галереи — превью радиокнопками. */
function PhotoChoice({ rowKey, photos, selected }: PhotoChoiceProps) {
  const t = useTranslations("admin.complexes.details");
  const name = detailField(rowKey, "photo");
  const current = photos.some((photo) => photo.id === selected) ? selected : null;
  if (photos.length === 0) return <p className="complex-details-form__empty">{t("noPhotos")}</p>;
  return (
    <fieldset className="complex-details-form__photos">
      <legend>{t("photo")}</legend>
      <label className="complex-details-form__photo complex-details-form__photo--none">
        <input type="radio" name={name} value="" defaultChecked={current === null} />
        <span>{t("withoutPhoto")}</span>
      </label>
      {photos.map((photo, index) => (
        <label key={photo.id} className="complex-details-form__photo">
          <input type="radio" name={name} value={photo.id} defaultChecked={current === photo.id} aria-label={t("photoNumber", { n: index + 1 })} />
          {/* eslint-disable-next-line @next/next/no-img-element -- превью из бакета в кабинете; next/image — на сайте */}
          <img src={photo.src} alt="" loading="lazy" decoding="async" />
        </label>
      ))}
    </fieldset>
  );
}
