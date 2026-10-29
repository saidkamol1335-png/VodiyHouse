"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { BilingualField } from "@/components/BilingualField";
import { ComplexTabForm } from "@/components/ComplexTabForm";
import { DETAIL_LIMITS, detailField, type DetailRow } from "@/lib/admin/complexes/details";
import type { PhotoItem } from "@/lib/admin/complexes/photos";
import type { DetailsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { useTabSave } from "@/lib/ui/useTabSave";

type ComplexDetailsFormProps = {
  complexId: string;
  details: readonly DetailRow[];
  /** Галерея ЖК: фото темы выбирают из неё (база другое не примет). */
  photos: readonly Pick<PhotoItem, "id" | "src">[];
  action: FormAction<DetailsResult>;
};

/**
 * Вкладка «Детали» (ТЗ 7.7, Ф4): темы справочника по порядку — текст RU | UZ и фото из галереи.
 * Тема без текста на сайт не попадает; раздел без тем скрыт целиком.
 */
export function ComplexDetailsForm({
  complexId,
  details,
  photos,
  action,
}: ComplexDetailsFormProps) {
  const t = useTranslations("admin.complexes");
  const save = useTabSave(action, t("unsaved"));
  const errors = save.state.status === "error" ? save.state.errors : {};
  const list = useOpenIssues(save.state);
  return (
    <ComplexTabForm
      title={t("details.title")}
      lead={t("details.lead")}
      complexId={complexId}
      save={save}
    >
      {details.length === 0 ? (
        <p className="complex-details-form__empty">{t("details.empty")}</p>
      ) : null}
      <div ref={list} className="complex-details-form">
        {details.map((detail) => {
          const issue = errors[detail.topicId];
          const filled = Boolean(detail.text.ru || detail.text.uz);
          return (
            <details
              key={detail.topicId}
              className="complex-details-form__topic"
              open={filled || Boolean(issue)}
              data-issue={issue ? "" : undefined}
            >
              <summary className="complex-details-form__summary">
                <span>{detail.name.ru}</span>
                <small>{filled ? t("details.filled") : t("details.blank")}</small>
              </summary>
              <input type="hidden" name="detailTopic" value={detail.topicId} />
              <BilingualField
                id={`complex-${detailField(detail.topicId, "text")}`}
                name={detailField(detail.topicId, "text")}
                label={t("details.text")}
                uzLabel={t("details.textUz")}
                maxLength={DETAIL_LIMITS.textMax}
                multiline
                defaultValue={detail.text}
                error={issue ? t(`issues.${issue}`) : undefined}
              />
              <PhotoChoice topicId={detail.topicId} photos={photos} selected={detail.photoId} />
            </details>
          );
        })}
      </div>
    </ComplexTabForm>
  );
}

/** Заполненная тема уже с open: свёрнутую руками проп не раскроет — тему с ошибкой открываем сами. */
function useOpenIssues(state: unknown) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelectorAll<HTMLDetailsElement>("details[data-issue]").forEach((topic) => {
      topic.open = true;
    });
  }, [state]);
  return list;
}

type PhotoChoiceProps = {
  topicId: number;
  photos: ComplexDetailsFormProps["photos"];
  selected: string | null;
};

/** Фото темы: «Без фото» или одно из галереи — превью радиокнопками. */
function PhotoChoice({ topicId, photos, selected }: PhotoChoiceProps) {
  const t = useTranslations("admin.complexes.details");
  const name = detailField(topicId, "photo");
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
          <input
            type="radio"
            name={name}
            value={photo.id}
            defaultChecked={current === photo.id}
            aria-label={t("photoNumber", { n: index + 1 })}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- превью из бакета в кабинете; next/image — на сайте */}
          <img src={photo.src} alt="" loading="lazy" decoding="async" />
        </label>
      ))}
    </fieldset>
  );
}
