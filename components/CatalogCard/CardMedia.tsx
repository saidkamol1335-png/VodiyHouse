"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type ReactNode, type UIEvent } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { Locale } from "@/lib/i18n/routing";
import type { CatalogPhoto } from "@/lib/site/catalog/records";

type CardMediaProps = {
  photos: readonly CatalogPhoto[];
  alt: string;
  /** Первые карточки первого экрана — фото грузится сразу (LCP). */
  preload: boolean;
  /** Бейджи слева сверху (класс ЖК). */
  badges: ReactNode;
};

const SIZES = "(max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 45vw, 400px";

/**
 * Фото карточки (мокап .jc__media): лента с прокруткой по кадрам — палец листает сам, стрелки на
 * десктопе при наведении, точки — какое фото сейчас. Кадр 4:3 по точке фокуса руководителя.
 */
export function CardMedia({ photos, alt, preload, badges }: CardMediaProps) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    setCurrent(Math.round(scrollLeft / Math.max(clientWidth, 1)));
  };
  const go = (step: number) => {
    const node = track.current;
    if (node) node.scrollBy({ left: step * node.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="catalog-card__media">
      <div ref={track} className="catalog-card__track" onScroll={onScroll}>
        {photos.map((photo, index) => (
          <div key={photo.path} className="catalog-card__slide" aria-hidden={index !== current}>
            <SitePhoto photo={photo} alt={photo.alt?.[locale] || alt} frame="card" sizes={SIZES} preload={preload && index === 0} className="catalog-card__photo" />
          </div>
        ))}
      </div>
      <div className="catalog-card__badges">{badges}</div>
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
