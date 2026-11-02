"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent, type UIEvent } from "react";
import { mediaPublicUrl } from "@/lib/media";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";

type GalleryViewerProps = {
  photos: readonly CatalogPhoto[];
  start: number;
  altOf: (photo: CatalogPhoto) => string;
  /** Закрыли — на каком кадре: галерея на странице встаёт туда же. */
  onClose: (index: number) => void;
};

const srcOf = (photo: CatalogPhoto) => mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", photo.path);

/**
 * Фото во весь экран (ТЗ 7.3а «полноэкранный просмотр по клику»): модальный <dialog> — фокус внутри,
 * Escape закрывает; фото целиком на тёмном фоне, свайп и стрелки ← →.
 */
/** Окно открывается сразу на нужном кадре; лента, текущий кадр и стрелки клавиатуры. */
function useViewer(start: number, total: number) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(start);
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    const node = track.current;
    if (node) node.scrollLeft = start * node.clientWidth;
  }, [start]);
  const goTo = (index: number) => {
    const node = track.current;
    if (node)
      node.scrollTo({
        left: index * node.clientWidth,
        behavior: getMotionTier() === "full" ? "smooth" : "auto",
      });
  };
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    setCurrent(Math.round(scrollLeft / Math.max(clientWidth, 1)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowRight") goTo(Math.min(current + 1, total - 1));
    if (event.key === "ArrowLeft") goTo(Math.max(current - 1, 0));
  };
  return { dialog, track, current, goTo, onScroll, onKeyDown };
}

export function GalleryViewer({ photos, start, altOf, onClose }: GalleryViewerProps) {
  const t = useTranslations("complex.gallery");
  const { dialog, track, current, goTo, onScroll, onKeyDown } = useViewer(start, photos.length);
  return (
    <dialog
      ref={dialog}
      className="complex-viewer"
      aria-label={t("photo", { n: current + 1, total: photos.length })}
      onClose={() => onClose(current)}
      onKeyDown={onKeyDown}
    >
      <div ref={track} className="complex-viewer__track" onScroll={onScroll}>
        {photos.map((photo, index) => (
          <figure key={photo.path} className="complex-viewer__slide" aria-hidden={index !== current}>
            {Math.abs(index - current) <= 1 ? <Image src={srcOf(photo)} alt={altOf(photo)} fill sizes="100vw" className="complex-viewer__image" /> : null}
          </figure>
        ))}
      </div>
      <button type="button" className="complex-viewer__close" aria-label={t("close")} onClick={() => dialog.current?.close()} autoFocus>
        <X size={20} aria-hidden />
      </button>
      {photos.length > 1 ? <ViewerArrows current={current} total={photos.length} goTo={goTo} /> : null}
      <span className="complex-viewer__count">{t("counter", { n: current + 1, total: photos.length })}</span>
    </dialog>
  );
}

function ViewerArrows({ current, total, goTo }: { current: number; total: number; goTo: (index: number) => void }) {
  const t = useTranslations("complex.gallery");
  return (
    <>
      <button type="button" className="complex-viewer__nav complex-viewer__nav--prev" aria-label={t("prev")} onClick={() => current > 0 && goTo(current - 1)} aria-disabled={current === 0}>
        <ChevronLeft size={22} aria-hidden />
      </button>
      <button type="button" className="complex-viewer__nav complex-viewer__nav--next" aria-label={t("next")} onClick={() => current < total - 1 && goTo(current + 1)} aria-disabled={current >= total - 1}>
        <ChevronRight size={22} aria-hidden />
      </button>
    </>
  );
}
