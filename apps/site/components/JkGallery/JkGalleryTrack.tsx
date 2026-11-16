"use client";

import { ArrowRight } from "lucide-react";
import { useRef } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { Link } from "@/lib/i18n/navigation";
import { useReveal } from "@/lib/motion";
import { ROUTES } from "@/lib/routes";
import type { ProjectWidth } from "@/lib/site/home/projects";
import type { SitePhotoData } from "@/lib/site/photo";
import { GalleryCard } from "./JkGalleryCard";
import { GalleryControls } from "./GalleryControls";
import { useGallerySlider } from "./useGallerySlider";

/** Предложение под названием ЖК: из «Витрины» (с бейджем и сроком) или условия оплаты ЖК. */
export type JkGalleryOffer = {
  badge: string | null;
  title: string;
  text: string | null;
  /** «до 30.11.2026 · ещё 24 дня»; у условий оплаты — null. */
  until: string | null;
  /** Осталось три дня и меньше — срок подсвечен. */
  hot: boolean;
};

export type JkGalleryCard = {
  slug: string;
  name: string;
  label: string;
  photo: SitePhotoData;
  alt: string;
  offer: JkGalleryOffer | null;
  width: ProjectWidth;
  meta: {
    place: string | null;
    developer: string | null;
    price: string | null;
    deadline: string | null;
  };
};

type JkGalleryText = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  all: string;
  allNote: string;
  /** Подписи стрелок и точек слайдера (правки 15.11, п. 5). */
  prev: string;
  next: string;
  /** «ЖК 2 из 6» — подпись каждой точки. */
  slides: string[];
};

/**
 * Лента ЖК — слайдер (правки 15.11, п. 5: «пусть крутится сам… захочу — переключу кнопкой»): нативная
 * горизонтальная прокрутка со scroll-snap (свайп на телефоне), стрелки ‹ › и точки; к прокрутке страницы
 * не привязана (закрепление GSAP убрано). Автопрокрутка — только в full: карточка в 5 с, пауза при
 * наведении, касании, фокусе внутри и когда лента не в кадре; lite и none — без автопрокрутки.
 */
type JkGalleryTrackProps = { id: string; cards: JkGalleryCard[]; text: JkGalleryText };

export function JkGalleryTrack({ id, cards, text }: JkGalleryTrackProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const total = cards.length + 1;
  const slider = useGallerySlider({ section: sectionRef, viewport: viewportRef, total });
  return (
    <section ref={sectionRef} id={id} className="jk-gallery" aria-labelledby="jk-gallery-title" aria-roledescription="carousel">
      <GalleryHead text={text} />
      <div ref={viewportRef} className="jk-gallery__viewport" {...slider.pauseHandlers}>
        <ul className="jk-gallery__track">
          {cards.map((card) => (
            <GalleryCard key={card.slug} card={card} />
          ))}
          <li className="jk-gallery__card jk-gallery__card--all">
            <Link href={ROUTES.catalog} className="jk-gallery__link jk-gallery__link--all">
              <span className="jk-gallery__all">
                {text.all}{" "}
                <ArrowRight className="jk-gallery__all-arrow" size={40} strokeWidth={1.4} aria-hidden />
              </span>
              <span className="jk-gallery__all-note">{text.allNote}</span>
            </Link>
          </li>
        </ul>
      </div>
      <GalleryControls current={slider.current} total={total} goTo={slider.goTo} text={text} />
    </section>
  );
}

/** Шапка ленты: проявляется при прокрутке (06.11.2026). */
function GalleryHead({ text }: { text: JkGalleryText }) {
  const headRef = useReveal<HTMLDivElement>();
  return (
    <div ref={headRef} className="jk-gallery__head container reveal">
      <Eyebrow>{text.eyebrow}</Eyebrow>
      <h2 id="jk-gallery-title" className="heading heading--h2 jk-gallery__heading">
        {text.title} <span className="heading__accent">{text.titleAccent}</span>
      </h2>
    </div>
  );
}
