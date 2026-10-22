import type { LiveOutcome } from "./liveStock";

// Расписание «live» главной (Г4 A): чтение раз в минуту, пока вкладка браузера видна; вернулись
// на вкладку (или на главную из другого раздела — Activity) через ≥ 10 с после прошлого чтения —
// читаем сразу. Цепочка таймеров, а не setInterval: медленный ответ не наслаивает чтения.
// Экземпляр живёт в useState — переживает StrictMode и Activity.

export const LIVE_POLL_MS = 60_000;
export const LIVE_RETURN_MS = 10_000;

export type LiveClock = { now: () => number; visible: () => boolean };

export const BROWSER_CLOCK: LiveClock = {
  now: () => Date.now(),
  visible: () => document.visibilityState === "visible",
};

export class LivePoller {
  private run: (() => Promise<LiveOutcome>) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private reading = false;
  private stopped = false;
  private lastAttempt: number | null = null;
  /** Когда показаны цифры страницы сервера; null — их не было (сервер не прочитал). */
  shownAt: number | null = null;

  /** fresh — у страницы свои свежие цифры: первое чтение — через минуту, а не сразу. */
  constructor(
    private readonly fresh: boolean,
    private readonly clock: LiveClock,
  ) {}

  connect(run: () => Promise<LiveOutcome>) {
    this.run = run;
    if (this.lastAttempt === null) {
      this.lastAttempt = this.fresh ? this.clock.now() : -Infinity;
      this.shownAt = this.fresh ? this.lastAttempt : null;
    }
    this.wake();
  }

  disconnect() {
    this.run = null;
    this.clear();
  }

  /** Подключили или вернулись на вкладку: давно не читали — читаем, иначе ждём своей минуты. */
  wake() {
    if (!this.run || this.stopped || this.reading) return;
    if (!this.clock.visible()) return this.clear();
    if (this.clock.now() - this.lastAttempt! >= LIVE_RETURN_MS) void this.read();
    else this.schedule();
  }

  private schedule() {
    this.clear();
    if (!this.run || this.stopped || !this.clock.visible()) return;
    const wait = Math.max(0, this.lastAttempt! + LIVE_POLL_MS - this.clock.now());
    this.timer = setTimeout(() => void this.read(), wait);
  }

  private async read() {
    const run = this.run;
    if (!run || this.reading) return;
    this.clear();
    this.reading = true;
    this.lastAttempt = this.clock.now();
    try {
      if ((await run()) === "stop") this.stopped = true;
    } finally {
      this.reading = false;
    }
    this.schedule();
  }

  private clear() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
