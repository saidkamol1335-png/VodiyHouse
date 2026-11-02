"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { isInFerganaRegion, parseCoordinates, yandexMapsUrl } from "@/lib/geo";

type PointFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  /** Ошибка сервера («не разобрать») — поверх разбора в браузере. */
  error?: string;
};

/** «Координаты или ссылка на карту» (И2): вставили — под полем точка и ссылка на проверку. */
export function PointField({ id, name, label, defaultValue = "", error }: PointFieldProps) {
  const t = useTranslations("admin.complexes.point");
  const [text, setText] = useState(defaultValue);
  const point = parseCoordinates(text);
  // Ошибка сервера — про отправленный текст: поправили поле — показываем разбор заново.
  const serverError = text === defaultValue ? error : undefined;
  const metaId = `${id}-meta`;
  return (
    <div className="field point-field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="point-field__control">
        <MapPin className="point-field__icon" size={16} aria-hidden="true" />
        <input
          id={id}
          name={name}
          className={
            serverError
              ? "field__input point-field__input field__input--error"
              : "field__input point-field__input"
          }
          inputMode="url"
          autoComplete="off"
          placeholder={t("placeholder")}
          value={text}
          aria-invalid={serverError ? true : undefined}
          aria-describedby={metaId}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div id={metaId} className="point-field__meta">
        <PointMeta text={text} point={point} error={serverError} />
      </div>
    </div>
  );
}

function PointMeta({
  text,
  point,
  error,
}: {
  text: string;
  point: ReturnType<typeof parseCoordinates>;
  error?: string;
}) {
  const t = useTranslations("admin.complexes.point");
  if (error) return <p className="field__error">{error}</p>;
  if (!text.trim()) return <p className="field__meta">{t("hint")}</p>;
  if (!point) return <p className="field__error">{t("invalid")}</p>;
  return (
    <p className="point-field__result">
      <span className="point-field__coords">
        {t("parsed", { lat: point.lat.toFixed(6), lng: point.lng.toFixed(6) })}
      </span>
      <a className="point-field__link" href={yandexMapsUrl(point)} target="_blank" rel="noreferrer">
        {t("open")}
        <ExternalLink size={13} aria-hidden="true" />
      </a>
      {isInFerganaRegion(point) ? null : (
        <span className="point-field__warning">{t("outside")}</span>
      )}
    </p>
  );
}
