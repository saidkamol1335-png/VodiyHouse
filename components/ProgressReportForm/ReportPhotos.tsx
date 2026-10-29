"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { PHOTOS_MAX, type PhotoTile } from "@/lib/admin/progress/usePhotoQueue";

type ReportPhotosProps = {
  tiles: readonly PhotoTile[];
  onAdd: (files: File[]) => number;
  onRemove: (key: string) => void;
  error: string | null;
};

/**
 * «Фото · N из 3–15» (мокап CabVideo .shots): квадраты с «×» и плитка «+» — выбор нескольких файлов
 * сразу (на телефоне — галерея или камера). Сверх 15 — подсказка, лишние не берутся.
 */
export function ReportPhotos({ tiles, onAdd, onRemove, error }: ReportPhotosProps) {
  const t = useTranslations("admin.video.form");
  const [limit, setLimit] = useState(false);
  const add = (files: File[]) => setLimit(onAdd(files) < files.length);
  const done = tiles.filter((tile) => tile.state === "done").length;
  return (
    <fieldset className="progress-form__photos">
      <legend className="progress-form__photos-head">
        <span className="progress-form__label">{t("photos", { count: done })}</span>
        <span className="progress-form__photos-hint">{t("photosHint")}</span>
      </legend>
      <ul className="progress-form__shots">
        {tiles.map((tile, index) => (
          <Shot key={tile.key} tile={tile} index={index} onRemove={onRemove} />
        ))}
        {tiles.length < PHOTOS_MAX ? <AddShot onAdd={add} /> : null}
      </ul>
      {tiles
        .filter((tile) => tile.state === "error")
        .map((tile) => (
          <p key={tile.key} className="progress-form__error" role="alert">
            {tile.error === "photoFailed"
              ? t("photoFailed", { name: tile.name })
              : t("photoUploadFailed")}
          </p>
        ))}
      {limit ? <p className="progress-form__notice">{t("photosLimit")}</p> : null}
      {error ? (
        <p className="progress-form__error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Shot({
  tile,
  index,
  onRemove,
}: {
  tile: PhotoTile;
  index: number;
  onRemove: (key: string) => void;
}) {
  const t = useTranslations("admin.video.form");
  return (
    <li className={`progress-form__shot progress-form__shot--${tile.state}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- превью из памяти браузера, до бакета */}
      {tile.preview ? <img src={tile.preview} alt="" /> : null}
      {tile.state === "working" ? (
        <Loader2 className="progress-form__spinner" size={20} aria-label={t("photoUploading")} />
      ) : null}
      <button
        type="button"
        className="progress-form__shot-remove"
        aria-label={t("removePhoto", { n: index + 1 })}
        onClick={() => onRemove(tile.key)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

/** Плитка «+»: выбор нескольких фото; поле очищается — тот же файл можно выбрать снова. */
function AddShot({ onAdd }: { onAdd: (files: File[]) => void }) {
  const t = useTranslations("admin.video.form");
  const input = useRef<HTMLInputElement>(null);
  return (
    <li className="progress-form__shot progress-form__shot--add">
      <label className="progress-form__add">
        <Plus size={22} aria-hidden="true" />
        <span className="sr-only">{t("addPhoto")}</span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            if (event.target.files) onAdd([...event.target.files]);
            if (input.current) input.current.value = "";
          }}
        />
      </label>
    </li>
  );
}
