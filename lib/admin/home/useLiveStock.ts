"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BROWSER_CLOCK, LivePoller } from "./livePoller";
import { initialLive, nextLive, outcomeOf, withoutFlashes, type LiveStock } from "./liveStock";
import { createLiveRead } from "./readOnce";
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

  // Activity прячет главную display:none, а при показе CSS перезапускает анимации — вспышки
  // прошлых перемен сыграли бы снова, будто числа только что сменились. Гасим показанные.
  const shownFlashes = useRef(state.flashes);
  useLayoutEffect(() => {
    shownFlashes.current = state.flashes;
  });
  useLayoutEffect(
    () => () => {
      const shown = shownFlashes.current;
      setState((prev) => withoutFlashes(prev, shown));
    },
    [],
  );
  const [liveRead] = useState(createLiveRead);

  // Вернулись на главную ссылкой — сервер прочитал свежие цифры: берём их (сменившиеся вспыхнут)
  // и не читаем то же самое действием сразу. До подключения расписания — порядок эффектов важен.
  const seen = useRef(initial);
  useEffect(() => {
    if (initial === null || initial === seen.current) return;
    seen.current = initial;
    poller.markFresh();
    setState((prev) => nextLive(prev, { status: "done", stock: initial }, Date.now(), null));
  }, [initial, poller]);

  useEffect(() => {
    const run = async () => {
      const result = await liveRead(() => readRef.current());
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
  }, [poller, liveRead]);

  return state;
}
