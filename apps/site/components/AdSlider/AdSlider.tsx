"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { AdBanner } from "@/components/AdBanner";
import type { ShowcaseAd } from "@/lib/site/showcase/records";
import { useSlider } from "@/lib/ui/useSlider";

type AdSliderProps = { ads: readonly ShowcaseAd[]; phone: string | null };

/**
 * Баннеры рекламы на главной (правки 15.11, п. 4 + 13): по порядку руководителя, свайп и scroll-snap,
 * стрелки и точки; один баннер — без них. Автопрокрутка — как у ленты «Проекты» (useSlider): только
 * full, пауза при наведении, фокусе и вне кадра, своё листание её выключает.
 */
export function AdSlider({ ads, phone }: AdSliderProps) {
  const t = useTranslations("showcase.banner");
  const section = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const slider = useSlider({ section, viewport, total: ads.length, item: ".ad-slider__slide" });
  if (ads.length === 1) return <AdBanner ad={ads[0]!} phone={phone} variant="slide" />;
  return (
    <div ref={section} className="ad-slider" role="region" aria-roledescription="carousel" aria-label={t("region")} {...slider.pauseHandlers}>
      <div ref={viewport} className="ad-slider__viewport">
        <ul className="ad-slider__track">
          {ads.map((ad, index) => (
            <li key={ad.id} className="ad-slider__slide" aria-roledescription="slide" aria-label={t("slide", { n: index + 1, total: ads.length })}>
              <AdBanner ad={ad} phone={phone} variant="slide" />
            </li>
          ))}
        </ul>
      </div>
      <div className="ad-slider__controls">
        <div className="ad-slider__dots">
          {Array.from({ length: slider.stops }, (_, index) => (
            <button
              key={index}
              type="button"
              className={index === slider.current ? "ad-slider__dot ad-slider__dot--on" : "ad-slider__dot"}
              aria-label={t("slide", { n: index + 1, total: slider.stops })}
              aria-current={index === slider.current ? "true" : undefined}
              onClick={() => slider.goTo(index)}
            />
          ))}
        </div>
        <div className="ad-slider__arrows">
          <button type="button" className="ad-slider__arrow" aria-label={t("prev")} onClick={() => slider.goTo(slider.current - 1)}>
            <ChevronLeft size={22} strokeWidth={1.8} aria-hidden />
          </button>
          <button type="button" className="ad-slider__arrow" aria-label={t("next")} onClick={() => slider.goTo(slider.current + 1)}>
            <ChevronRight size={22} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
