"use client";

import { type FocusEvent, type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { getMotionTier, useMotion } from "@/lib/motion";

/** Карточка в кадре столько, потом лента сама листает дальше (только full). */
export const AUTOPLAY_MS = 5_000;
/** После касания пальцем лента ждёт столько, прежде чем снова листать сама. */
const TOUCH_RESUME_MS = 6_000;

type SliderRefs = { section: RefObject<HTMLElement | null>; viewport: RefObject<HTMLElement | null>; total: number };

/** Карточки ленты и отступ snap слева (у первой карточки — поле контейнера). */
function cardsOf(viewport: HTMLElement): HTMLElement[] {
  return [...viewport.querySelectorAll<HTMLElement>(".jk-gallery__card")];
}

/** Ближайшая к левому краю кадра карточка; в конце ленты — последняя (её левый край может не дойти). */
function currentOf(viewport: HTMLElement): number {
  const cards = cardsOf(viewport);
  const first = cards[0]?.offsetLeft ?? 0;
  if (viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 4) return cards.length - 1;
  let best = 0;
  cards.forEach((card, index) => {
    if (Math.abs(card.offsetLeft - first - viewport.scrollLeft) < Math.abs((cards[best]?.offsetLeft ?? 0) - first - viewport.scrollLeft)) best = index;
  });
  return best;
}

/** Прокрутка к карточке: плавно только в full (lite и none — сразу). */
function scrollToCard(viewport: HTMLElement, index: number) {
  const cards = cardsOf(viewport);
  const card = cards[index];
  if (!card) return;
  viewport.scrollTo({ left: card.offsetLeft - (cards[0]?.offsetLeft ?? 0), behavior: getMotionTier() === "full" ? "smooth" : "auto" });
}

/** Номер карточки в кадре — по прокрутке ленты (свайп, стрелки, автопрокрутка). */
function useCurrent(viewport: RefObject<HTMLElement | null>) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCurrent(currentOf(node)));
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
    };
  }, [viewport]);
  return current;
}

/** Лента в кадре — автопрокрутка не листает то, чего не видно. */
function useInView(section: RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [section]);
  return inView;
}

/**
 * Слайдер ленты «Проекты Vodiy House» (правки 15.11, п. 5): текущая карточка, переход к карточке и
 * автопрокрутка — только в full, пауза при наведении мышью, касании (и 6 с после него), фокусе внутри,
 * скрытой вкладке и когда лента не в кадре. После последней карточки — снова первая.
 */
export function useGallerySlider({ section, viewport, total }: SliderRefs) {
  const tier = useMotion();
  const current = useCurrent(viewport);
  const inView = useInView(section);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [touchedAt, setTouchedAt] = useState(0);
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  const goTo = useCallback(
    (index: number) => {
      const node = viewport.current;
      if (node) scrollToCard(node, ((index % total) + total) % total);
    },
    [viewport, total],
  );
  const paused = tier !== "full" || !inView || hover || focus;
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      if (document.hidden || Date.now() - touchedAt < TOUCH_RESUME_MS) return;
      goTo(currentRef.current + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, touchedAt, goTo]);
  const pauseHandlers = {
    onPointerEnter: (event: PointerEvent) => event.pointerType === "mouse" && setHover(true),
    onPointerLeave: (event: PointerEvent) => event.pointerType === "mouse" && setHover(false),
    onPointerDown: (event: PointerEvent) => event.pointerType !== "mouse" && setTouchedAt(Date.now()),
    onFocus: () => setFocus(true),
    onBlur: (event: FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocus(false);
    },
  };
  return { current, goTo, pauseHandlers, autoplay: !paused };
}
