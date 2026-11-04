"use client";

import type { FlatFrames, FrameSet } from "@/lib/site/home/flatFrames";

const frameName = (index: number) => `${String(index + 1).padStart(4, "0")}.webp`;

/** Путь кадра: телефон — папка m/. */
export const frameUrl = (frames: FlatFrames, mobile: boolean, index: number) =>
  `${frames.base}/${mobile ? "m/" : ""}${frameName(index)}`;

/**
 * Последовательность кадров на canvas (как у Apple): картинки грузятся и декодируются заранее
 * (img.decode), рисуется только при смене кадра; пока нужный кадр не готов — ближайший готовый.
 */
export class FrameSequence {
  readonly set: FrameSet;
  private readonly images: (HTMLImageElement | null)[];
  private readonly ready: boolean[];
  private loading = false;

  constructor(
    private readonly frames: FlatFrames,
    private readonly mobile: boolean,
    private readonly onReady: () => void,
  ) {
    this.set = mobile ? frames.mobile : frames.desktop;
    this.images = Array.from({ length: this.set.count }, () => null);
    this.ready = Array.from({ length: this.set.count }, () => false);
  }

  /** Первый кадр — сразу. */
  loadFirst(): void {
    this.loadFrame(0);
  }

  /** Все кадры: по 4 параллельно, от первого к последнему. */
  loadAll(): void {
    if (this.loading) return;
    this.loading = true;
    let next = 0;
    const pump = () => {
      while (next < this.set.count && this.images[next]) next += 1;
      if (next >= this.set.count) return;
      void this.loadFrame(next++).then(pump);
    };
    for (let lane = 0; lane < 4; lane += 1) pump();
  }

  private loadFrame(index: number): Promise<void> {
    if (this.images[index]) return Promise.resolve();
    const image = new Image();
    image.decoding = "async";
    image.src = frameUrl(this.frames, this.mobile, index);
    this.images[index] = image;
    const done = () => {
      if (this.ready[index]) return;
      this.ready[index] = true;
      this.onReady();
    };
    // Готов — что раньше: декодирован заранее (decode) или просто загружен (в фоновой вкладке decode
    // может ждать до показа; drawImage тогда декодирует сам).
    return new Promise<void>((resolve) => {
      const finish = () => {
        done();
        resolve();
      };
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
      image.decode().then(finish, () => undefined);
    });
  }

  /** Готовый кадр, ближайший к нужному; null — ещё ничего нет. */
  nearest(index: number): HTMLImageElement | null {
    for (let step = 0; step < this.set.count; step += 1) {
      for (const candidate of [index - step, index + step]) {
        if (candidate >= 0 && candidate < this.set.count && this.ready[candidate])
          return this.images[candidate] ?? null;
      }
    }
    return null;
  }

  /** Нарисовать кадр доли turn (0 — сверху, 1 — 3/4) по центру canvas, вписав. */
  draw(context: CanvasRenderingContext2D, turn: number): HTMLImageElement | null {
    const index = Math.round(Math.min(1, Math.max(0, turn)) * (this.set.count - 1));
    const image = this.nearest(index);
    // Номер кадра — метка для e2e (как data-phase у первого экрана), CSS её не читает.
    context.canvas.dataset.frame = String(index);
    const { width, height } = context.canvas;
    context.clearRect(0, 0, width, height);
    if (!image) return null;
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    return image;
  }
}
