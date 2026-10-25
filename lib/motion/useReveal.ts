"use client";

import { useCallback } from "react";
import { getMotionTier } from "./tier";

/** Атрибут, который получает элемент, когда впервые показался: значение — режим в этот момент. */
export const REVEALED_ATTRIBUTE = "data-revealed";

/**
 * Один хук появления для всего сайта (PLAN 3а): элемент получает data-revealed="<режим>", когда
 * впервые виден, — без перерисовки React. Как он появляется, решает CSS режима (full — полная
 * анимация, lite — короткое проявление, none — сразу). Режим в значении нужен потому, что старт —
 * всегда lite: показанное в lite не должно пропасть и проиграться заново, когда проба включит full.
 * Без IntersectionObserver — сразу виден.
 */
export function useReveal<T extends Element>(rootMargin = "0px 0px -10% 0px") {
  return useCallback(
    (node: T | null) => {
      if (!node) return;
      if (typeof IntersectionObserver === "undefined") {
        node.setAttribute(REVEALED_ATTRIBUTE, getMotionTier());
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          node.setAttribute(REVEALED_ATTRIBUTE, getMotionTier());
          observer.disconnect();
        },
        { rootMargin },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [rootMargin],
  );
}
