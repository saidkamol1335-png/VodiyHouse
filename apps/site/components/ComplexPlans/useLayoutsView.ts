"use client";

import { useEffect, type RefObject } from "react";
import { track } from "@/lib/events/client";

const SEEN_MS = 1000;
// Полоса посередине экрана (30% высоты): раздел в ней — «на экране» при любой его высоте. Доля
// раздела не годится: у ЖК с 18 планировками в одну колонку на телефоне он выше 10 экранов.
const MIDDLE_BAND = "-35% 0px -35% 0px";

/**
 * «Смотрели планировки» (фаза 6, «Путь посетителя» мокапа CabStats): раздел «Планировки» не меньше
 * секунды посреди экрана — одно событие layout_view на открытие страницы ЖК (ЖК — из TrackView).
 */
export function useLayoutsView(section: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = section.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.at(-1)?.isIntersecting) {
          clearTimeout(timer);
          timer = undefined;
          return;
        }
        timer ??= setTimeout(() => {
          track("layout_view");
          observer.disconnect();
        }, SEEN_MS);
      },
      { rootMargin: MIDDLE_BAND },
    );
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [section]);
}
