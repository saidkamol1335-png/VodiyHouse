"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type DragEvent } from "react";
import type { PhotoItem } from "@/lib/admin/complexes/photos";
import type { PendingPhoto, PhotoGallery } from "@/lib/admin/complexes/usePhotoGallery";
import { MEDIA_LIMITS, objectPosition, MEDIA_KIND_RULES } from "@/lib/media";

// Плитка галереи — кадр карточки сайта (4:3).
const TILE_RATIO = 4 / 3;
const MEGABYTE = 1024 * 1024;

type PhotoGridProps = {
  gallery: PhotoGallery;
  selected: string | null;
  locked: boolean;
  onSelect: (id: string | null) => void;
  onFiles: (files: File[]) => void;
};

/** Плитки: фото по порядку (первое — обложка), загружаемые, «+» — пачка файлов. */
export function PhotoGrid({ gallery, selected, locked, onSelect, onFiles }: PhotoGridProps) {
  const drag = useTileDrag(gallery.move);
  return (
    <ul className="complex-photos__grid">
      {gallery.photos.map((photo, index) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          index={index}
          selected={photo.id === selected}
          draggable={!gallery.uploading}
          onSelect={() => onSelect(photo.id === selected ? null : photo.id)}
          onDragStart={() => drag.start(photo.id)}
          onDrop={(event) => drag.drop(event, index)}
        />
      ))}
      {gallery.pending.map((item) => (
        <PendingTile key={item.key} item={item} onDismiss={() => gallery.dismiss(item.key)} />
      ))}
      <li className="complex-photos__tile complex-photos__tile--add">
        <AddTile locked={locked} onFiles={onFiles} />
      </li>
    </ul>
  );
}

/** Перетаскивание мышью: какую плитку тянут и куда отпустили. */
function useTileDrag(move: PhotoGallery["move"]) {
  const [dragging, setDragging] = useState<string | null>(null);
  return {
    start: (id: string) => setDragging(id),
    drop: (event: DragEvent, targetIndex: number) => {
      event.preventDefault();
      if (dragging) void move(dragging, targetIndex);
      setDragging(null);
    },
  };
}

type PhotoTileProps = {
  photo: PhotoItem;
  index: number;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDrop: (event: DragEvent) => void;
};

function PhotoTile({ photo, index, selected, draggable, onSelect, onDragStart, onDrop }: PhotoTileProps) {
  const t = useTranslations("admin.complexes.photos");
  return (
    <li
      className={selected ? "complex-photos__tile complex-photos__tile--selected" : "complex-photos__tile"}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      data-testid="photo-tile"
    >
      <button type="button" className="complex-photos__open" aria-label={t("open", { index: index + 1 })} aria-pressed={selected} onClick={onSelect}>
        {/* eslint-disable-next-line @next/next/no-img-element -- превью из бакета в кабинете; next/image — на сайте */}
        <img src={photo.src} alt="" loading="lazy" decoding="async" style={{ objectPosition: objectPosition(photo, TILE_RATIO, photo.focus) }} />
      </button>
      {index === 0 ? <span className="complex-photos__cover">{t("cover")}</span> : null}
    </li>
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
  const message = item.issue ? t(`media.issues.${item.issue.code}`, item.issue) : item.error ? t(`developers.errors.${item.error}`) : t("media.uploadFailed");
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
