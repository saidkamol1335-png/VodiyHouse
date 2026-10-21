"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type DragEvent } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { FormStatus } from "@/components/FormStatus";
import { Rule12Check } from "@/components/Rule12Check";
import { PHOTO_LIMITS, type PhotoActions, type PhotoItem } from "@/lib/admin/complexes/photos";
import {
  usePhotoGallery,
  type GalleryError,
  type PendingPhoto,
} from "@/lib/admin/complexes/usePhotoGallery";
import { MEDIA_LIMITS, objectPosition, MEDIA_KIND_RULES } from "@/lib/media";
import { PhotoPanel } from "./PhotoPanel";

type ComplexPhotosProps = {
  complexId: string;
  /** Опубликованный ЖК: фото сразу на сайте — загрузка с отметкой правила 1.2 (И8). */
  published: boolean;
  photos: readonly PhotoItem[];
  actions: PhotoActions | null;
};

// Плитка галереи — кадр карточки сайта (4:3).
const TILE_RATIO = 4 / 3;
const MEGABYTE = 1024 * 1024;

/** Вкладка «Фото» (И6): плитки как «Фото · 0 из 3–15» у видеографа, первое — обложка. */
export function ComplexPhotos({
  complexId,
  published,
  photos: initial,
  actions,
}: ComplexPhotosProps) {
  const t = useTranslations("admin.complexes.photos");
  const tAdmin = useTranslations("admin");
  const [rule12, setRule12] = useState(false);
  const gallery = usePhotoGallery({ complexId, initial, actions, rule12 });
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const current = gallery.photos.find((photo) => photo.id === selected) ?? null;
  const locked = published && !rule12;
  const drop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (dragging) void gallery.move(dragging, targetIndex);
    setDragging(null);
  };
  // Отметка 1.2 — на одну пачку (И8): снимается, если хоть одно фото загрузилось.
  const upload = (files: File[]) =>
    void gallery.upload(files).then((uploaded) => {
      if (uploaded > 0) setRule12(false);
    });

  return (
    <AdminPanel title={t("title")} wide>
      <div className="complex-photos">
        <p className="complex-photos__lead">
          {t("count", {
            count: gallery.photos.length,
            min: PHOTO_LIMITS.minForPublish,
            max: PHOTO_LIMITS.max,
          })}
        </p>
        {published ? (
          <Rule12Check id="rule12-photos" checked={rule12} onChange={setRule12} context="photo" />
        ) : (
          <p className="field__meta">{tAdmin("media.rule12Hint")}</p>
        )}
        <ul className="complex-photos__grid">
          {gallery.photos.map((photo, index) => (
            <li
              key={photo.id}
              className={
                photo.id === selected
                  ? "complex-photos__tile complex-photos__tile--selected"
                  : "complex-photos__tile"
              }
              draggable={!gallery.uploading}
              onDragStart={() => setDragging(photo.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, index)}
              data-testid="photo-tile"
            >
              <button
                type="button"
                className="complex-photos__open"
                aria-label={t("open", { index: index + 1 })}
                aria-pressed={photo.id === selected}
                onClick={() => setSelected(photo.id === selected ? null : photo.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- превью из бакета в кабинете; next/image — на сайте */}
                <img
                  src={photo.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: objectPosition(photo, TILE_RATIO, photo.focus) }}
                />
              </button>
              {index === 0 ? <span className="complex-photos__cover">{t("cover")}</span> : null}
            </li>
          ))}
          {gallery.pending.map((item) => (
            <PendingTile key={item.key} item={item} onDismiss={() => gallery.dismiss(item.key)} />
          ))}
          <li className="complex-photos__tile complex-photos__tile--add">
            <AddTile locked={locked} onFiles={upload} />
          </li>
        </ul>
        <GalleryProblem error={gallery.error} />
        {current ? (
          <PhotoPanel
            photo={current}
            index={gallery.photos.indexOf(current)}
            count={gallery.photos.length}
            moveLocked={gallery.uploading}
            onMove={(to) => void gallery.move(current.id, to)}
            onFocus={(focus) => gallery.setFocus(current.id, focus)}
            onRemove={async () => {
              if (await gallery.remove(current.id)) setSelected(null);
            }}
          />
        ) : null}
      </div>
    </AdminPanel>
  );
}

function AddTile({ locked, onFiles }: { locked: boolean; onFiles: (files: File[]) => void }) {
  const t = useTranslations("admin");
  const hint = t("media.hint", {
    minLongSide: MEDIA_KIND_RULES.photo.minLongSide,
    maxMegabytes: MEDIA_LIMITS.maxSourceBytes / MEGABYTE,
  });
  return (
    <label className="complex-photos__add" aria-disabled={locked || undefined} title={hint}>
      <input
        type="file"
        multiple
        accept={MEDIA_LIMITS.acceptedTypes.join(",")}
        disabled={locked}
        aria-label={t("complexes.photos.add")}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <Plus size={22} aria-hidden="true" />
      <span>{t("complexes.photos.add")}</span>
    </label>
  );
}

function PendingTile({ item, onDismiss }: { item: PendingPhoto; onDismiss: () => void }) {
  const t = useTranslations("admin");
  const message = item.issue
    ? t(`media.issues.${item.issue.code}`, item.issue)
    : item.error
      ? t(`developers.errors.${item.error}`)
      : t("media.uploadFailed");
  // Ошибка — на всю строку сетки: в плитке 100×75 (390) причина и «Убрать» не помещаются.
  const className = item.failed
    ? "complex-photos__tile complex-photos__tile--pending complex-photos__tile--failed"
    : "complex-photos__tile complex-photos__tile--pending";
  return (
    <li className={className} data-testid="photo-pending">
      {item.failed ? (
        <span className="complex-photos__failed" role="alert">
          <b>{item.name}</b> {message}
          <button type="button" className="complex-photos__dismiss" onClick={onDismiss}>
            {t("complexes.photos.dismiss")}
          </button>
        </span>
      ) : (
        <span className="complex-photos__busy">{t("media.processing")}</span>
      )}
    </li>
  );
}

function GalleryProblem({ error }: { error: GalleryError }) {
  const t = useTranslations("admin");
  if (!error) return null;
  if (error.error === "notCover") {
    const min = MEDIA_LIMITS.complexCoverMinLongSide;
    return <FormStatus tone="error">{t("complexes.photos.notCover", { min })}</FormStatus>;
  }
  if (error.broken.length > 0) {
    const broken = error.broken.map((item) => t(`complexes.status.missing.${item}`)).join(" · ");
    return <FormStatus tone="error">{`${t("complexes.brokenLead")} ${broken}`}</FormStatus>;
  }
  return <FormStatus tone="error">{t(`developers.errors.${error.error}`)}</FormStatus>;
}
