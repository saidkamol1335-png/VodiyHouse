"use client";

import { type FocusEvent, type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { getMotionTier, useMotion } from "@/lib/motion";

/** Карточка в кадре столько, потом лента сама листает дальше (только full). */
export const AUTOPLAY_MS = 5_000;

type SliderRefs = { section: RefObject<HTMLElement | null>; viewport: RefObject<HTMLElement | null>; total: number };

function cardsOf(viewport: HTMLElement): HTMLElement[] {
  return [...viewport.querySelectorAll<HTMLElement>(".jk-gallery__card")];
}

/** Сдвиг прокрутки, при котором карточка встаёт к левому краю (у первой — поле контейнера). */
const offsetOf = (cards: HTMLElement[], index: number) => (cards[index]?.offsetLeft ?? 0) - (cards[0]?.offsetLeft ?? 0);

/**
 * Сколько остановок у ленты: карточки, чей левый край доезжает до края кадра, и конец ленты. Последние
 * карточки на широком экране целиком видны в конце — у них одна общая остановка (иначе точка, которая
 * никогда не станет текущей).
 */
function stopsOf(viewport: HTMLElement): number {
  const cards = cardsOf(viewport);
  const end = viewport.scrollWidth - viewport.clientWidth;
  const reachable = cards.filter((_, index) => offsetOf(cards, index) < end - 4).length;
  return Math.max(1, Math.min(cards.length, reachable + 1));
}

/** Текущая остановка — ближайшая к прокрутке; в самом конце — последняя. */
function currentOf(viewport: HTMLElement, stops: number): number {
  const cards = cardsOf(viewport);
  const end = viewport.scrollWidth - viewport.clientWidth;
  if (viewport.scrollLeft >= end - 4) return stops - 1;
  let best = 0;
  for (let index = 0; index < stops - 1; index += 1) {
    if (Math.abs(offsetOf(cards, index) - viewport.scrollLeft) < Math.abs(offsetOf(cards, best) - viewport.scrollLeft)) best = index;
  }
  return best;
}

/** Прокрутка к остановке: последняя — конец ленты; плавно только в full. */
function scrollToStop(viewport: HTMLElement, index: number, stops: number) {
  const cards = cardsOf(viewport);
  const left = index >= stops - 1 ? viewport.scrollWidth : offsetOf(cards, index);
  viewport.scrollTo({ left, behavior: getMotionTier() === "full" ? "smooth" : "auto" });
}

/** Остановки и текущая — по прокрутке и размеру ленты (свайп, стрелки, автопрокрутка, поворот экрана). */
function useStops(viewport: RefObject<HTMLElement | null>, total: number) {
  const [stops, setStops] = useState(total);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const count = stopsOf(node);
        setStops(count);
        setCurrent(currentOf(node, count));
      });
    };
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(node);
    node.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [viewport]);
  return { stops, current };
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
 * Слайдер ленты «Проекты Vodiy House» (правки 15.11, п. 5): остановки, текущая и переход. Автопрокрутка —
 * только в full; пауза, пока мышь или фокус в секции (лента, стрелки, точки), вкладка скрыта или лента не
 * в кадре. Любое своё листание (стрелка, точка, касание, свайп) выключает автопрокрутку насовсем — так её
 * можно остановить и с клавиатуры, и диктором (WCAG 2.2.2). После последней остановки — снова первая.
 */
export function useGallerySlider({ section, viewport, total }: SliderRefs) {
  const tier = useMotion();
  const { stops, current } = useStops(viewport, total);
  const inView = useInView(section);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [stopped, setStopped] = useState(false);
  const position = useRef({ current, stops });
  useEffect(() => {
    position.current = { current, stops };
  }, [current, stops]);
  const scrollTo = useCallback(
    (index: number) => {
      const node = viewport.current;
      const count = position.current.stops;
      if (node) scrollToStop(node, ((index % count) + count) % count, count);
    },
    [viewport],
  );
  const paused = tier !== "full" || stopped || !inView || hover || focus;
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) scrollTo(position.current.current + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, scrollTo]);
  const goTo = (index: number) => {
    setStopped(true);
    scrollTo(index);
  };
  const pauseHandlers = {
    onPointerEnter: (event: PointerEvent) => event.pointerType === "mouse" && setHover(true),
    onPointerLeave: (event: PointerEvent) => event.pointerType === "mouse" && setHover(false),
    // Палец на ленте — человек листает сам.
    onPointerDown: (event: PointerEvent) => event.pointerType !== "mouse" && setStopped(true),
    onFocus: () => setFocus(true),
    onBlur: (event: FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocus(false);
    },
  };
  return { current, stops, goTo, pauseHandlers, autoplay: !paused };
}
