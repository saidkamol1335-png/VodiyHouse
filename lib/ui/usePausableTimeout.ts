"use client";

import { useEffect, useState } from "react";

// Таймер, который можно придержать: полоса «Отменить» 5 с не уходит, пока на неё навели мышь,
// в ней фокус или вкладка браузера скрыта — с клавиатуры до неё за 5 с иначе не дойти
// (WCAG 2.2.1). Причин паузы может быть несколько: таймер идёт, только когда их нет.

export class PausableTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private remaining = 0;
  private startedAt = 0;
  private armed = false;
  private readonly reasons = new Set<string>();

  constructor(private onExpire: () => void = () => {}) {}

  /** Что сделать по истечении — последнее значение из рендера (ставится в эффекте). */
  setHandler(onExpire: () => void) {
    this.onExpire = onExpire;
  }

  start(ms: number) {
    this.stop();
    this.remaining = ms;
    this.armed = true;
    this.run();
  }

  pause(reason: string) {
    this.reasons.add(reason);
    this.stop();
  }

  resume(reason: string) {
    this.reasons.delete(reason);
    this.run();
  }

  cancel() {
    this.stop();
    this.armed = false;
  }

  private run() {
    if (!this.armed || this.timer !== null || this.reasons.size > 0) return;
    this.startedAt = Date.now();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.armed = false;
      this.onExpire();
    }, this.remaining);
  }

  private stop() {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt));
  }
}

/** key — что показывается (новое значение — отсчёт заново); null — таймера нет. */
export function usePausableTimeout(key: number | null, ms: number, onExpire: () => void) {
  const [timer] = useState(() => new PausableTimer());
  useEffect(() => {
    timer.setHandler(onExpire);
  });
  useEffect(() => {
    if (key === null) return;
    timer.start(ms);
    const visibility = () =>
      document.visibilityState === "hidden" ? timer.pause("hidden") : timer.resume("hidden");
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      timer.cancel();
    };
  }, [key, ms, timer]);
  return timer;
}
