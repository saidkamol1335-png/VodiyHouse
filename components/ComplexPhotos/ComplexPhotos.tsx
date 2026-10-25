"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { FormStatus } from "@/components/FormStatus";
import { Rule12Check } from "@/components/Rule12Check";
import { PHOTO_LIMITS, type PhotoActions, type PhotoItem } from "@/lib/admin/complexes/photos";
import { usePhotoGallery, type GalleryError, type PhotoGallery } from "@/lib/admin/complexes/usePhotoGallery";
import { MEDIA_LIMITS } from "@/lib/media";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoPanel } from "./PhotoPanel";

type ComplexPhotosProps = {
  complexId: string;
  /** Опубликованный ЖК: фото сразу на сайте — загрузка с отметкой правила 1.2 (И8). */
  published: boolean;
  photos: readonly PhotoItem[];
  actions: PhotoActions | null;
};

/** Вкладка «Фото» (И6): плитки как «Фото · 0 из 3–15» у видеографа, первое — обложка. */
export function ComplexPhotos({ complexId, published, photos, actions }: ComplexPhotosProps) {
  const t = useTranslations("admin");
  const [rule12, setRule12] = useState(false);
  const gallery = usePhotoGallery({ complexId, initial: photos, actions, rule12 });
  const [selected, setSelected] = useState<string | null>(null);
  // Отметка 1.2 — на одну пачку (И8): снимается, если хоть одно фото загрузилось.
  const upload = (files: File[]) =>
    void gallery.upload(files).then((uploaded) => {
      if (uploaded > 0) setRule12(false);
    });
  return (
    <AdminPanel title={t("complexes.photos.title")} wide>
      <div className="complex-photos">
        <GalleryLead count={gallery.photos.length} />
        {published ? (
          <Rule12Check id="rule12-photos" checked={rule12} onChange={setRule12} context="photo" />
        ) : (
          <p className="field__meta">{t("media.rule12Hint")}</p>
        )}
        <PhotoGrid gallery={gallery} selected={selected} locked={published && !rule12} onSelect={setSelected} onFiles={upload} />
        <GalleryProblem error={gallery.error} />
        <SelectedPanel gallery={gallery} selected={selected} onRemoved={() => setSelected(null)} />
      </div>
    </AdminPanel>
  );
}

function GalleryLead({ count }: { count: number }) {
  const t = useTranslations("admin.complexes.photos");
  return <p className="complex-photos__lead">{t("count", { count, min: PHOTO_LIMITS.minForPublish, max: PHOTO_LIMITS.max })}</p>;
}

type SelectedPanelProps = {
  gallery: PhotoGallery;
  selected: string | null;
  onRemoved: () => void;
};

/** Панель выбранного фото. Без key: при смене фото панель та же (как было до разбиения). */
function SelectedPanel({ gallery, selected, onRemoved }: SelectedPanelProps) {
  const current = gallery.photos.find((photo) => photo.id === selected) ?? null;
  if (!current) return null;
  return (
    <PhotoPanel
      photo={current}
      index={gallery.photos.indexOf(current)}
      count={gallery.photos.length}
      moveLocked={gallery.uploading}
      onMove={(to) => void gallery.move(current.id, to)}
      onFocus={(focus) => gallery.setFocus(current.id, focus)}
      onRemove={async () => {
        if (await gallery.remove(current.id)) onRemoved();
      }}
    />
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
