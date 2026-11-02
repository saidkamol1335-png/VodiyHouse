"use client";

import { useCallback } from "react";
import { REVEAL_OFF_ATTRIBUTE } from "@/lib/boot/anchorStart";
import { getMotionTier } from "./tier";

/** Атрибут, который получает элемент, когда впервые показался: значение — режим в этот момент. */
export const REVEALED_ATTRIBUTE = "data-revealed";
/** Значение для уже показанного: под него не подходит ни один CSS появления. */
const SHOWN = "shown";

/**
 * Один хук появления для всего сайта (PLAN 3а): элемент получает data-revealed="<режим>", когда
 * впервые виден, — без перерисовки React. Как он появляется, решает CSS режима (full — полная
 * анимация, lite — короткое проявление, none — сразу). Режим в значении нужен потому, что старт —
 * всегда lite: показанное в lite не должно пропасть и проиграться заново, когда проба включит full.
 * Next держит ушедшую страницу в скрытом Activity: при «Назад» CSS заново запустил бы анимации, поэтому
 * показанное получает значение shown. Метка data-reveal-off (скрипт в <head>): страница открылась не с
 * начала или долго не оживает — появления нет, блоки уже на месте.
 * Без IntersectionObserver — сразу виден.
 */
export function useReveal<T extends Element>(rootMargin = "0px 0px -10% 0px") {
  return useCallback(
    (node: T | null) => {
      if (!node) return;
      if (
        node.hasAttribute(REVEALED_ATTRIBUTE) ||
        document.documentElement.hasAttribute(REVEAL_OFF_ATTRIBUTE)
      ) {
        node.setAttribute(REVEALED_ATTRIBUTE, SHOWN);
        return;
      }
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
