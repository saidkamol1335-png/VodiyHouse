"use client";

import { Camera, Images, Loader2, WifiOff, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ChangeEvent } from "react";
import { PHOTOS_MAX, type PhotoTile } from "@/lib/admin/progress/usePhotoQueue";

type ReportPhotosProps = {
  tiles: readonly PhotoTile[];
  onAdd: (files: File[]) => number;
  onRemove: (key: string) => void;
  error: string | null;
};

/**
 * «Фото · N из 3–15» (мокап CabVideo .shots; фаза E, п. 37): квадраты с «×», «Снять» (камера телефона) и
 * «Из галереи» (несколько файлов сразу). Нет сети — плитка «ждёт сети» и догрузится сама. Сверх 15 —
 * подсказка, лишние не берутся.
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
      </ul>
      {tiles.length < PHOTOS_MAX ? <AddShots onAdd={add} /> : null}
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
      {/* eslint-disable-next-line @next/next/no-img-element -- превью из памяти браузера или подписанный адрес */}
      {tile.preview ? <img src={tile.preview} alt="" /> : null}
      {tile.state === "waiting" ? <WaitBadge tile={tile} /> : null}
      {tile.state === "working" ? (
        <Loader2
          className="progress-form__spinner"
          size={20}
          role="img"
          aria-label={t("photoUploading")}
        />
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

/** «Ждёт сети» / «Повтор через N с» — поверх плитки. */
function WaitBadge({ tile }: { tile: PhotoTile }) {
  const t = useTranslations("admin.video.form");
  const text = tile.wait?.reason === "retry" ? t("photoRetry", { seconds: tile.wait.seconds }) : t("photoWaiting");
  return (
    <span className="progress-form__shot-wait" role="status">
      <WifiOff size={14} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
}

/**
 * «Снять» — камера телефона (capture: на компьютере откроется выбор файла) и «Из галереи» — несколько
 * файлов. Поле очищается — тот же файл можно выбрать снова.
 */
function AddShots({ onAdd }: { onAdd: (files: File[]) => void }) {
  const t = useTranslations("admin.video.form");
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) onAdd([...event.target.files]);
    event.target.value = "";
  };
  return (
    <div className="progress-form__pick">
      <label className="progress-form__pick-button progress-form__pick-button--camera">
        <Camera size={20} aria-hidden="true" />
        {t("camera")}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pick} />
      </label>
      <label className="progress-form__pick-button">
        <Images size={20} aria-hidden="true" />
        {t("gallery")}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pick} />
      </label>
    </div>
  );
}
