"use client";

import { useEffect, type RefObject } from "react";
import { track } from "@/lib/events/client";

/** Показ рекламы (3.16б): карточка наполовину в кадре — одно событие ad_view на открытие страницы. */
export function useAdView(card: RefObject<HTMLElement | null>, id: string): void {
  useEffect(() => {
    const node = card.current;
    if (!node) return;
    const seen = () => track("ad_view", { entity_type: "ad", entity_id: id });
    if (typeof IntersectionObserver === "undefined") {
      seen();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        seen();
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [card, id]);
}
