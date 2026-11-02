"use client";

import { useSyncExternalStore } from "react";

// «Обновлено 5 мин назад» у сотен строк: одни часы на всех подписчиков, тикают раз в 30 с, пока
// кто-то подписан. На сервере и до гидратации — null: время сервера и телефона расходится.

const TICK_MS = 30_000;
const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Снимок обязан быть одним и тем же между вызовами (иначе React перерисовывает без конца):
// время берётся один раз и дальше меняется только тиком.
function snapshot() {
  if (now === 0) now = Date.now();
  return now;
}
const serverSnapshot = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
