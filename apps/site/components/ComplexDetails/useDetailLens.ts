"use client";

import { type PointerEvent, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getMotionTier, useFinePointer } from "@/lib/motion";
import { lensPlacement, type LensPlace } from "./geometry";

/** Курсор задержался на карточке — линза открывается (пролёт мимо её не открывает). */
const OPEN_DELAY_MS = 120;
/** Окно на переход курсора между карточкой и линзой. */
const CLOSE_DELAY_MS = 140;
const GROW_MS = 420;
const GROW_EASE = "cubic-bezier(0.19, 1, 0.22, 1)";

export type DetailLens = {
  /** Карточка под линзой; null — линза закрыта. */
  index: number | null;
  /** Линза работает только у мыши: на тач-экране — «Читать далее» и окно. */
  enabled: boolean;
  hover: (index: number, event: PointerEvent<HTMLElement>) => void;
  leave: () => void;
  keep: () => void;
  close: () => void;
};

type Timers = { open: number; close: number };

/**
 * Линза «Деталей проекта»: курсор задержался на карточке — над ней вырастает читающий слой шире в
 * 1,5 раза с полным текстом (FLIP из карточки в full, проявление в lite, сразу в none — это функция
 * чтения, не украшение). Соседняя карточка — линза переезжает. Закрывается: курсор ушёл с карточки и
 * линзы, прокрутка страницы, Escape, нажатие вне блока.
 */
export function useDetailLens(root: RefObject<HTMLElement | null>, lens: RefObject<HTMLElement | null>): DetailLens {
  const enabled = useFinePointer();
  const [index, setIndex] = useState<number | null>(null);
  const timers = useRef<Timers>({ open: 0, close: 0 });
  const grow = useRef<LensPlace | null>(null);

  const close = () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
    setIndex(null);
  };
  const show = (next: number, card: HTMLElement) => {
    const host = root.current;
    const layer = lens.current;
    if (!host || !layer) return;
    const place = lensPlacement(card.getBoundingClientRect(), host.getBoundingClientRect());
    layer.style.setProperty("--lens-x", `${place.x.toFixed(1)}px`);
    layer.style.setProperty("--lens-y", `${place.y.toFixed(1)}px`);
    layer.style.setProperty("--lens-w", `${place.width.toFixed(1)}px`);
    if (index === null) grow.current = place;
    setIndex(next);
  };
  const hover = (next: number, event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.pointerType !== "mouse") return;
    window.clearTimeout(timers.current.close);
    if (index === next) return;
    window.clearTimeout(timers.current.open);
    const card = event.currentTarget;
    timers.current.open = window.setTimeout(() => show(next, card), index === null ? OPEN_DELAY_MS : 0);
  };
  const leave = () => {
    window.clearTimeout(timers.current.open);
    timers.current.close = window.setTimeout(() => setIndex(null), CLOSE_DELAY_MS);
  };
  const keep = () => window.clearTimeout(timers.current.close);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      window.clearTimeout(pending.open);
      window.clearTimeout(pending.close);
    };
  }, []);
  useLensGrow(lens, index, grow);
  useLensDismiss(root, index !== null, close);
  return { index, enabled, hover, leave, keep, close };
}

/** Линза открылась — вырастает из карточки (full) или проявляется (lite). */
function useLensGrow(lens: RefObject<HTMLElement | null>, index: number | null, growRef: RefObject<LensPlace | null>) {
  useLayoutEffect(() => {
    const layer = lens.current;
    const place = growRef.current;
    if (index === null || !layer || !place) return;
    growRef.current = null;
    const tier = getMotionTier();
    if (tier === "none") return;
    const keyframes =
      tier === "full"
        ? [
            { transform: `translate(${place.dx}px, ${place.dy}px) scale(${place.scale})`, opacity: 0 },
            { transform: "none", opacity: 1 },
          ]
        : [{ opacity: 0 }, { opacity: 1 }];
    const animation = layer.animate(keyframes, { duration: tier === "full" ? GROW_MS : 160, easing: GROW_EASE });
    return () => animation.cancel();
  }, [lens, index, growRef]);
}

/** Прокрутка ленты, Escape и нажатие вне блока закрывают линзу. */
function useLensDismiss(root: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    const host = root.current;
    if (!open || !host) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current();
    };
    const onDown = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node) || !host.contains(event.target)) latest.current();
    };
    const onScroll = () => latest.current();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [root, open]);
}
