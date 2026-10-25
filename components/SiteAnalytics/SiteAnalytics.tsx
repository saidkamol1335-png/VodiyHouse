"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { flushEvents, setTrackContext, track, trackClick } from "@/lib/events/client";
import { hasPixels, startPixels } from "@/lib/events/pixels";
import type { EventEntity, EventType } from "@/lib/events/types";

const FIRST_ACTIONS = ["scroll", "pointerdown", "keydown", "touchstart"] as const;
const IDLE_TIMEOUT_MS = 6000;

/** Пиксели — после первого действия посетителя или в простое, что раньше. */
function usePixelsLater() {
  useEffect(() => {
    if (!hasPixels) return;
    const start = () => {
      stop();
      startPixels();
    };
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS }) : window.setTimeout(start, IDLE_TIMEOUT_MS);
    const stop = () => {
      FIRST_ACTIONS.forEach((name) => window.removeEventListener(name, start));
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
    FIRST_ACTIONS.forEach((name) => window.addEventListener(name, start, { passive: true }));
    return stop;
  }, []);
}

/**
 * События сайта (шаг 3.12): просмотр страницы при каждом переходе, отправка очереди при уходе со
 * страницы, пиксели рекламы. Ничего не рисует.
 */
export function SiteAnalytics() {
  const pathname = usePathname();
  usePixelsLater();
  useEffect(() => {
    track("page_view");
  }, [pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => trackClick(event.target);
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushEvents();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushEvents);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushEvents);
    };
  }, []);
  return null;
}

/** Просмотр объекта (страница ЖК): одно событие при открытии. */
export function TrackView({ type, entity, id }: { type: EventType; entity: EventEntity; id: string }) {
  useEffect(() => {
    setTrackContext({ entity_type: entity, entity_id: id });
    track(type, { entity_type: entity, entity_id: id });
  }, [type, entity, id]);
  return null;
}
