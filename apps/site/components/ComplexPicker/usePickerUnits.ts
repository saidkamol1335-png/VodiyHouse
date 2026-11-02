"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readComplexUnitsAction } from "@/lib/site/complex/actions";
import type { PickerUnit } from "@/lib/site/picker/records";
import { PICKER_REFRESH } from "@/lib/site/picker/refresh";

export type PickerUnits = {
  /** Квартиры по блокам; блока ещё нет — грузится. */
  byBlock: Record<string, PickerUnit[]>;
  /** Время последнего ответа — «обновлено 14:05». */
  updatedAt: Date | null;
  failed: boolean;
  retry: () => void;
};

/**
 * Квартиры блоков раздела одним запросом (block_units мимо кэша): первый раз — когда раздел подошёл
 * к экрану, потом с паузой, которую назвал сервер (по числу посетителей онлайн: 60, 30 или 15 с), пока
 * он на экране и вкладка видна, и сразу при возвращении на вкладку. Один запрос за раз; ответ старше
 * последнего не применяется; ушли со страницы — опрос останавливается.
 */
export function usePickerUnits(blockIds: readonly string[], section: React.RefObject<HTMLElement | null>): PickerUnits {
  const [byBlock, setByBlock] = useState<Record<string, PickerUnit[]>>({});
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const refreshMs = useRef<number>(PICKER_REFRESH.usual);
  const key = blockIds.join(",");
  const load = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const request = readComplexUnitsAction(key.split(",").filter(Boolean))
      .catch(() => null)
      .then((answer) => {
        setFailed(!answer);
        if (!answer) return;
        setByBlock(answer.units);
        refreshMs.current = answer.refreshMs;
        setUpdatedAt(new Date());
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = request;
    return request;
  }, [key]);
  usePolling(load, section, refreshMs);
  return { byBlock, updatedAt, failed, retry: () => void load() };
}

function usePolling(
  load: () => Promise<void>,
  section: React.RefObject<HTMLElement | null>,
  refreshMs: React.RefObject<number>,
) {
  useEffect(() => {
    const node = section.current;
    if (!node) return;
    let timer: number | undefined;
    let visible = false;
    let stopped = false;
    const tick = () => {
      window.clearTimeout(timer);
      if (stopped || !visible || document.hidden) return;
      void load().finally(() => {
        // Два вызова tick ждут один запрос — таймер остаётся один.
        window.clearTimeout(timer);
        if (!stopped) timer = window.setTimeout(tick, refreshMs.current);
      });
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        const was = visible;
        visible = Boolean(entry?.isIntersecting);
        if (visible && !was) tick();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", tick);
      window.clearTimeout(timer);
    };
  }, [load, section, refreshMs]);
}
