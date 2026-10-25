"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type ReactNode, type UIEvent } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { Locale } from "@/lib/i18n/routing";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";

type CardMediaProps = {
  photos: readonly CatalogPhoto[];
  alt: string;
  /** Первые карточки первого экрана — фото грузится сразу (LCP). */
  preload: boolean;
  /** Бейджи слева сверху (класс ЖК). */
  badges: ReactNode;
  /** Кнопки справа сверху: избранное и «Поделиться» (мокап .jc__icons). */
  tools?: ReactNode;
};

const SIZES = "(max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 45vw, 400px";

/**
 * Фото карточки (мокап .jc__media): лента с прокруткой по кадрам — палец листает сам, стрелки на
 * десктопе при наведении, точки — какое фото сейчас. Кадр 4:3 по точке фокуса руководителя.
 * Сначала грузится только обложка: ленивая загрузка в горизонтальной ленте не срабатывает, и все
 * фото всех карточек отнимали канал у первого экрана (Lighthouse, LCP). Остальные кадры — после
 * первого наведения, касания, фокуса или прокрутки ленты; до того — их размытые заглушки.
 */
export function CardMedia({ photos, alt, preload, badges, tools }: CardMediaProps) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [armed, setArmed] = useState(false);
  const arm = () => setArmed(true);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    setArmed(true);
    setCurrent(Math.round(scrollLeft / Math.max(clientWidth, 1)));
  };
  const go = (step: number) => {
    const node = track.current;
    // Плавно — только в full: lite и reduced-motion листают сразу (CLAUDE.md §3).
    if (node) node.scrollBy({ left: step * node.clientWidth, behavior: getMotionTier() === "full" ? "smooth" : "auto" });
  };
  return (
    <div className="catalog-card__media" onPointerEnter={arm} onTouchStart={arm} onFocus={arm}>
      <div ref={track} className="catalog-card__track" onScroll={onScroll}>
        {photos.map((photo, index) => (
          <div key={photo.path} className="catalog-card__slide" aria-hidden={index !== current}>
            <CardSlide photo={photo} alt={photo.alt?.[locale] || alt} loaded={index === 0 || armed} preload={preload && index === 0} />
          </div>
        ))}
      </div>
      <div className="catalog-card__badges">{badges}</div>
      {tools ? <div className="catalog-card__tools">{tools}</div> : null}
      {photos.length > 1 ? (
        <>
          <button type="button" className="catalog-card__nav catalog-card__nav--prev" aria-label={t("prevPhoto")} onClick={() => go(-1)} disabled={current === 0}>
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          <button type="button" className="catalog-card__nav catalog-card__nav--next" aria-label={t("nextPhoto")} onClick={() => go(1)} disabled={current >= photos.length - 1}>
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
          <div className="catalog-card__dots" role="img" aria-label={t("photo", { n: current + 1, total: photos.length })}>
            {photos.map((photo, index) => (
              <i key={photo.path} className={index === current ? "catalog-card__dot catalog-card__dot--on" : "catalog-card__dot"} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

type CardSlideProps = { photo: CatalogPhoto; alt: string; loaded: boolean; preload: boolean };

/** Кадр ленты: фото — или, пока галерею не трогали, его размытое превью. */
function CardSlide({ photo, alt, loaded, preload }: CardSlideProps) {
  if (!loaded) {
    const style = photo.blur ? { backgroundImage: `url("${photo.blur}")` } : undefined;
    return <div className="catalog-card__placeholder" style={style} />;
  }
  return <SitePhoto photo={photo} alt={alt} frame="card" sizes={SIZES} preload={preload} className="catalog-card__photo" />;
}
