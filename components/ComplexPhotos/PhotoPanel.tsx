"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { FocusPreview } from "@/components/FocusPreview";
import { canBeCover, type PhotoItem } from "@/lib/admin/complexes/photos";
import { MEDIA_LIMITS, type FocusPoint } from "@/lib/media";

type PhotoPanelProps = {
  photo: PhotoItem;
  index: number;
  count: number;
  /** Идёт загрузка: порядок не меняем, пока база не знает всех фото. */
  moveLocked: boolean;
  onMove: (to: number) => void;
  onFocus: (focus: FocusPoint) => void;
  onRemove: () => Promise<void>;
};

/** Панель выбранного фото (И6): точка фокуса и три кадра, «Сделать обложкой», ← →, «Удалить». */
export function PhotoPanel(props: PhotoPanelProps) {
  const { photo, index, count, moveLocked, onMove, onFocus, onRemove } = props;
  const t = useTranslations("admin.complexes.photos");
  const [confirming, setConfirming] = useState(false);
  const coverAllowed = canBeCover(photo);
  return (
    <section className="photo-panel" aria-label={t("panel", { index: index + 1 })}>
      <FocusPreview src={photo.src} size={photo} focus={photo.focus} onFocusChange={onFocus} />
      <div className="photo-panel__actions">
        {index > 0 ? (
          <Button size="sm" disabled={!coverAllowed || moveLocked} onClick={() => onMove(0)}>
            {t("makeCover")}
          </Button>
        ) : (
          <span className="photo-panel__note">{t("isCover")}</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={index === 0 || moveLocked}
          aria-label={t("left")}
          onClick={() => onMove(index - 1)}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={index === count - 1 || moveLocked}
          aria-label={t("right")}
          onClick={() => onMove(index + 1)}
        >
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
        {confirming ? (
          <span className="photo-panel__confirm">
            {t("removeConfirm")}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void onRemove().then(() => setConfirming(false))}
            >
              {t("removeYes")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {t("removeCancel")}
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            {t("remove")}
          </Button>
        )}
      </div>
      {index > 0 && !coverAllowed ? (
        <p className="field__meta">
          {t("notCover", { min: MEDIA_LIMITS.complexCoverMinLongSide })}
        </p>
      ) : null}
      <p className="field__meta">{t("size", { width: photo.width, height: photo.height })}</p>
    </section>
  );
}
