"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type GalleryControlsProps = {
  current: number;
  total: number;
  goTo: (index: number) => void;
  text: { prev: string; next: string; slides: string[] };
};

/**
 * Стрелки ‹ › и точки под лентой (правки 15.11, п. 5) — вне карточек: карточка целиком ссылка, кнопка
 * внутри ссылки недопустима. Стрелки листают по кругу; точка — к своей карточке.
 */
export function GalleryControls({ current, total, goTo, text }: GalleryControlsProps) {
  return (
    <div className="jk-gallery__controls container">
      <div className="jk-gallery__dots">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            className={index === current ? "jk-gallery__dot jk-gallery__dot--on" : "jk-gallery__dot"}
            aria-label={text.slides[index]}
            aria-current={index === current ? "true" : undefined}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
      <div className="jk-gallery__arrows">
        <button type="button" className="jk-gallery__arrow" aria-label={text.prev} onClick={() => goTo(current - 1)}>
          <ChevronLeft size={22} strokeWidth={1.8} aria-hidden />
        </button>
        <button type="button" className="jk-gallery__arrow" aria-label={text.next} onClick={() => goTo(current + 1)}>
          <ChevronRight size={22} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </div>
  );
}
