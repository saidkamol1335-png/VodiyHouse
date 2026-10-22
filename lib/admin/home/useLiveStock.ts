"use client";

import { useEffect, useRef, useState } from "react";
import { settle } from "@/lib/ui/settle";
import { BROWSER_CLOCK, LivePoller } from "./livePoller";
import {
  NETWORK_FAILURE,
  initialLive,
  isSiteStockResult,
  nextLive,
  outcomeOf,
  type LiveStock,
} from "./liveStock";
import type { SiteStock, SiteStockResult } from "./siteStock";

export type SiteStockRead = () => Promise<SiteStockResult>;

/**
 * «Остатки по ЖК» вживую (Г4 A): первые цифры — со страницы сервера (без мигания загрузки),
 * дальше — чтение действием по расписанию LivePoller. Сервер не прочитал (initial null) —
 * читаем сразу.
 */
export function useLiveStock(initial: SiteStock | null, read: SiteStockRead): LiveStock {
  const [state, setState] = useState(() => initialLive(initial));
  const [poller] = useState(() => new LivePoller(initial !== null, BROWSER_CLOCK));
  // Действие — из ref: новая ссылка на него при перерисовке не должна перезапускать расписание.
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  });

  useEffect(() => {
    const run = async () => {
      const answer = await settle(() => readRef.current(), NETWORK_FAILURE);
      const result = isSiteStockResult(answer) ? answer : NETWORK_FAILURE;
      setState((prev) => nextLive(prev, result, Date.now(), poller.shownAt));
      return outcomeOf(result);
    };
    const onVisibility = () => poller.wake();
    document.addEventListener("visibilitychange", onVisibility);
    poller.connect(run);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      poller.disconnect();
    };
  }, [poller]);

  return state;
}
