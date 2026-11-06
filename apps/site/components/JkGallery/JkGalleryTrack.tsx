"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { Link } from "@/lib/i18n/navigation";
import { useMotion, useReveal } from "@/lib/motion";
import { ROUTES } from "@/lib/routes";
import type { ProjectWidth } from "@/lib/site/home/projects";
import type { SitePhotoData } from "@/lib/site/photo";
import { GalleryCard } from "./JkGalleryCard";
import { keepPlaceAbove, loadGsap, refreshWhenSettled, type GsapKit } from "@/lib/site/scroll/gsap";

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
  hint: string;
};

/** Pin и горизонтальный трек — full и lite на ≥ 768 px (gsap.matchMedia); настройку ОС не слушаем. */
const PINNED_QUERY = "(min-width: 768px)";

/**
 * Лента ЖК. По умолчанию (none, телефон, без JS) — нативная горизонтальная прокрутка со
 * scroll-snap. В full и lite (с 06.11.2026, слово исполнителя: «при скролле должна листаться
 * горизонтально») на широком экране секция закрепляется, трек едет влево на всю свою длину
 * (scrub), названия — со своей скоростью (containerAnimation), фото въезжает 1.08 → 1. Tab по
 * карточкам прокручивает страницу к карточке. Анимируются только transform.
 */
type JkGalleryTrackProps = { id: string; cards: JkGalleryCard[]; text: JkGalleryText };

export function JkGalleryTrack({ id, cards, text }: JkGalleryTrackProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  useGalleryPin(sectionRef, trackRef);
  return (
    <section ref={sectionRef} id={id} className="jk-gallery" aria-labelledby="jk-gallery-title">
      {/* Закрепляется обёртка, а не сама секция: GSAP переносит её в pin-spacer, а корень компонента
          остаётся там, где его ждёт React (иначе removeChild при размонтировании падает). */}
      <div className="jk-gallery__pin">
        <GalleryHead text={text} />
        <div className="jk-gallery__viewport">
          <ul ref={trackRef} className="jk-gallery__track">
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
        <p className="jk-gallery__hint" aria-hidden>
          <span className="jk-gallery__hint-line" />
          {text.hint}
        </p>
      </div>
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

/** Закрепление — в full и lite: GSAP грузится отдельным чанком, откат при смене режима (none — нет). */
function useGalleryPin(
  sectionRef: RefObject<HTMLElement | null>,
  trackRef: RefObject<HTMLElement | null>,
) {
  const tier = useMotion();
  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (tier === "none" || !section || !track) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    loadGsap()
      .then((kit) => {
        if (cancelled) return;
        keepPlaceAbove(kit, section, () => {
          revert = pinGallery(kit, section, track);
        });
      })
      // GSAP не загрузился — остаётся нативная лента.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [tier, sectionRef, trackRef]);
}

/** Закрепление и трек; возвращает откат (снимает pin, стили и слушатели). */
function pinGallery(
  { gsap, ScrollTrigger }: GsapKit,
  section: HTMLElement,
  track: HTMLElement,
): () => void {
  const mm = gsap.matchMedia();
  mm.add(PINNED_QUERY, () => {
    section.classList.add("jk-gallery--pinned");
    // Ширина без полосы прокрутки: в конце пути последняя карточка видна целиком.
    const distance = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    const pin = section.querySelector<HTMLElement>(".jk-gallery__pin")!;
    const slide = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        pin: true,
        start: "top top",
        end: () => `+=${distance()}`,
        scrub: 1,
        invalidateOnRefresh: true,
        // will-change — только пока секция закреплена.
        onToggle: (self) => section.toggleAttribute("data-live", self.isActive),
      },
    });
    cardParallax(gsap, track, slide);
    warmPhotos(ScrollTrigger, section, track);
    const onFocus = focusToCard(slide, distance);
    track.addEventListener("focusin", onFocus);
    refreshWhenSettled({ gsap, ScrollTrigger }, section);
    return () => {
      track.removeEventListener("focusin", onFocus);
      section.classList.remove("jk-gallery--pinned");
      section.removeAttribute("data-live");
    };
  });
  return () => mm.revert();
}

/**
 * Карточки за правым краем обрезаны overflow: clip — ленивые фото там не начали бы грузиться до
 * въезда. За экран до секции им ставится loading="eager".
 */
function warmPhotos(
  ScrollTrigger: GsapKit["ScrollTrigger"],
  section: HTMLElement,
  track: HTMLElement,
) {
  ScrollTrigger.create({
    trigger: section,
    start: "top bottom+=100%",
    once: true,
    onEnter: () => track.querySelectorAll("img").forEach((image) => (image.loading = "eager")),
  });
}

/** Название с предложением — своя скорость (xPercent 20 → −20), фото въезжает 1.08 → 1: по движению трека. */
function cardParallax(gsap: GsapKit["gsap"], track: HTMLElement, slide: gsap.core.Tween) {
  for (const card of track.querySelectorAll<HTMLElement>(".jk-gallery__card")) {
    const title = card.querySelector(".jk-gallery__caption");
    const media = card.querySelector(".jk-gallery__media");
    const along = { trigger: card, containerAnimation: slide, scrub: true } as const;
    if (title) {
      gsap.fromTo(
        title,
        { xPercent: 20 },
        {
          xPercent: -20,
          ease: "none",
          scrollTrigger: { ...along, start: "left right", end: "right left" },
        },
      );
    }
    if (media) {
      gsap.fromTo(
        media,
        { scale: 1.08 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: { ...along, start: "left right", end: "left 35%" },
        },
      );
    }
  }
}

/** Tab по карточке: страница прокручивается так, чтобы карточка встала в кадр. */
function focusToCard(slide: gsap.core.Tween, distance: () => number) {
  return (event: FocusEvent) => {
    // Только фокус с клавиатуры: щелчок мышью тоже фокусирует ссылку, но страницу двигать нельзя.
    if (!(event.target as Element).matches(":focus-visible")) return;
    const card = (event.target as Element).closest<HTMLElement>(".jk-gallery__card");
    const trigger = slide.scrollTrigger;
    if (!card || !trigger) return;
    const max = distance();
    const x = Math.min(
      max,
      Math.max(0, card.offsetLeft - (document.documentElement.clientWidth - card.offsetWidth) / 2),
    );
    const top = trigger.start + (max > 0 ? x / max : 0) * (trigger.end - trigger.start);
    window.scrollTo({ top, behavior: "instant" });
    trigger.update();
  };
}
