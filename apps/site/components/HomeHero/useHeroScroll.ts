"use client";

import { useEffect, type RefObject } from "react";
import { COPY_FADE_AT, LEDGER_OUT_AT, THROUGH } from "@/lib/site/home/heroRise";
import { HeroScroller, type HeroScrollMode } from "./heroScroller";

export type { HeroScrollMode } from "./heroScroller";

/**
 * Прокрутка первого экрана «Ufq · Раскол» (heroRise): в stick сцена липнет на --home-hero-travel —
 * текст уходит, заголовок уменьшается к шапке, рамки выходят из-за горизонта, камера «ныряет» в
 * центральную, экран раскалывается и в щель поднимается каталог; в drift рамки поднимаются, пока экран
 * уезжает. Фокус: в ушедший текст — к началу сцены, за первый экран — к её концу (каталог под пластинами).
 */
export function useHeroScroll({
  mode,
  smooth,
  section,
}: {
  mode: HeroScrollMode;
  smooth: boolean;
  section: RefObject<HTMLElement | null>;
}): void {
  useEffect(() => {
    const host = section.current;
    if (!host || mode === "none") return;
    const scroller = new HeroScroller(host, mode, smooth);
    const sizes = new ResizeObserver(scroller.resize);
    const focus = (event: FocusEvent) => onFocus(host, scroller, mode, event);
    window.addEventListener("scroll", scroller.schedule, { passive: true });
    window.addEventListener("resize", scroller.resize);
    document.addEventListener("focusin", focus);
    sizes.observe(host);
    void document.fonts?.ready.then(scroller.resize);
    scroller.update();
    return () => {
      window.removeEventListener("scroll", scroller.schedule);
      window.removeEventListener("resize", scroller.resize);
      document.removeEventListener("focusin", focus);
      sizes.disconnect();
      scroller.destroy();
    };
  }, [mode, smooth, section]);
  useLive(section);
}

function onFocus(
  host: HTMLElement,
  scroller: HeroScroller,
  mode: HeroScrollMode,
  event: FocusEvent,
) {
  if (mode !== "stick") return;
  const target = event.target as Element;
  const p = scroller.progress;
  if (host.contains(target)) {
    const inCopy = target.closest(".home-hero__copy") && p > COPY_FADE_AT;
    const inLedger = target.closest(".home-hero__ledger") && p > LEDGER_OUT_AT;
    if (inCopy || inLedger) scroller.jump(scroller.start);
    return;
  }
  const after = host.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING;
  if (after && p < THROUGH.on && window.scrollY < scroller.end) scroller.jump(scroller.end);
}

/** Слои поднимаются в отдельные (will-change), пока первый экран рядом с окном, — один раз, не в сцене. */
function useLive(section: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const host = section.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) host.setAttribute("data-live", "");
        else host.removeAttribute("data-live");
      },
      { rootMargin: "50% 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [section]);
}
