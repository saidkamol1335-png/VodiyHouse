"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState, type UIEvent } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { GalleryViewer } from "./GalleryViewer";

type ComplexGalleryProps = {
  photos: readonly CatalogPhoto[];
  /** «ЖК Shodlik» — подпись фото без своего alt. */
  name: string;
  locale: "ru" | "uz";
  /** Сердце и «Поделиться» в углу фото (мокап .gal .jc__icons). */
  tools?: ReactNode;
};

/** Миниатюры поверх фото (мокап .gal__thumbs): больше пяти — уже не помещаются. */
const THUMBS = 5;
const SIZES = "(max-width: 760px) 100vw, (max-width: 1280px) calc(100vw - 64px), 1216px";

/** Лента кадров: какой кадр сейчас и как листать (плавно — только в full, CLAUDE.md §3). */
function useTrack() {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [armed, setArmed] = useState(false);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    setArmed(true);
    setCurrent(Math.round(scrollLeft / Math.max(clientWidth, 1)));
  };
  const goTo = (index: number) => {
    const node = track.current;
    setArmed(true);
    if (node)
      node.scrollTo({
        left: index * node.clientWidth,
        behavior: getMotionTier() === "full" ? "smooth" : "auto",
      });
  };
  return { track, current, armed, arm: () => setArmed(true), onScroll, goTo };
}

/**
 * Галерея ЖК (мокап .gal, ТЗ 7.3а; телефон — .jg): лента со свайпом, стрелки, миниатюры и счётчик
 * «1 / 5», по нажатию — во весь экран. Подписей нет (решение заказчика). Сразу грузится только
 * первое фото (LCP); остальные — после первого касания, наведения или прокрутки ленты.
 */
export function ComplexGallery({ photos, name, locale, tools }: ComplexGalleryProps) {
  const t = useTranslations("complex.gallery");
  const { track, current, armed, arm, onScroll, goTo } = useTrack();
  const [viewer, setViewer] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const altOf = (photo: CatalogPhoto) => photo.alt?.[locale] || name;
  return (
    <div className="complex-gallery" role="group" aria-label={t("label", { name })} onPointerEnter={arm} onTouchStart={arm} onFocus={arm}>
      <div ref={track} className="complex-gallery__track" onScroll={onScroll}>
        {photos.map((photo, index) => (
          <GallerySlide key={photo.path} photo={photo} alt={altOf(photo)} index={index} total={photos.length} current={current} loaded={index === 0 || armed} onOpen={() => setViewer(index)} />
        ))}
      </div>
      <span className="complex-gallery__shade" aria-hidden="true" />
      {photos.length > 1 ? <GalleryControls photos={photos} current={current} goTo={goTo} /> : null}
      <GalleryCount current={current} total={photos.length} />
      {tools ? <div className="complex-gallery__tools">{tools}</div> : null}
      {viewer !== null ? (
        <GalleryViewer
          photos={photos}
          start={viewer}
          altOf={altOf}
          onClose={(index) => {
            setViewer(null);
            goTo(index);
          }}
        />
      ) : null}
    </div>
  );
}

type GallerySlideProps = { photo: CatalogPhoto; alt: string; index: number; total: number; current: number; loaded: boolean; onOpen: () => void };

/** Кадр ленты: фото — или, пока галерею не трогали, его размытое превью; нажатие — во весь экран. */
function GallerySlide({ photo, alt, index, total, current, loaded, onOpen }: GallerySlideProps) {
  const t = useTranslations("complex.gallery");
  return (
    <button
      type="button"
      className="complex-gallery__slide"
      aria-label={`${t("open")} · ${t("photo", { n: index + 1, total })}`}
      aria-hidden={index !== current}
      tabIndex={index === current ? 0 : -1}
      onClick={onOpen}
    >
      {loaded ? (
        <SitePhoto photo={photo} alt={alt} frame="cover" phoneFrame="card" sizes={SIZES} preload={index === 0} className="complex-gallery__photo" />
      ) : (
        <span className="complex-gallery__placeholder" style={photo.blur ? { backgroundImage: `url("${photo.blur}")` } : undefined} />
      )}
    </button>
  );
}

/** «1 / 5» на фото; диктору — «Фото 1 из 5». */
function GalleryCount({ current, total }: { current: number; total: number }) {
  const t = useTranslations("complex.gallery");
  return (
    <span className="complex-gallery__count" aria-live="polite">
      <ImageIcon size={14} strokeWidth={2} aria-hidden />
      <span className="sr-only">{t("photo", { n: current + 1, total })}</span>
      <span aria-hidden="true">{t("counter", { n: current + 1, total })}</span>
    </span>
  );
}

type GalleryControlsProps = {
  photos: readonly CatalogPhoto[];
  current: number;
  goTo: (index: number) => void;
};

function GalleryControls({ photos, current, goTo }: GalleryControlsProps) {
  const t = useTranslations("complex.gallery");
  return (
    <>
      <button
        type="button"
        className="complex-gallery__nav complex-gallery__nav--prev"
        aria-label={t("prev")}
        onClick={() => current > 0 && goTo(current - 1)}
        aria-disabled={current === 0}
      >
        <ChevronLeft size={18} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="complex-gallery__nav complex-gallery__nav--next"
        aria-label={t("next")}
        onClick={() => current < photos.length - 1 && goTo(current + 1)}
        aria-disabled={current >= photos.length - 1}
      >
        <ChevronRight size={18} strokeWidth={2} aria-hidden />
      </button>
      <div className="complex-gallery__thumbs">
        {photos.slice(0, THUMBS).map((photo, index) => (
          <button
            key={photo.path}
            type="button"
            className={index === current ? "complex-gallery__thumb complex-gallery__thumb--on" : "complex-gallery__thumb"}
            aria-label={t("thumb", { n: index + 1 })}
            aria-pressed={index === current}
            onClick={() => goTo(index)}
          >
            <SitePhoto photo={photo} alt="" frame="card" sizes="96px" className="complex-gallery__thumb-photo" />
          </button>
        ))}
      </div>
    </>
  );
}
