"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FrameLoader } from "./frameLoader";
import {
  BLUEPRINT_FADE,
  BUILD_END,
  BUILD_START,
  clamp01,
  FINALE_AT,
  FINALE_FADE,
  FOCUS_X,
  FRAME_COUNT,
  FRAME_WIDTH,
  frameSrc,
  INTRO_FADE,
  PAST_INTRO_AT,
  span,
} from "./stages";
import type { ScrubFrame } from "./types";

type Callbacks = {
  /** Кадр изменился (вызов на каждый кадр анимации — обновлять DOM напрямую, состояние — по этапам). */
  onFrame: (state: ScrubFrame) => void;
  /** Первый кадр нарисован — постер можно убрать. */
  onDrawn: () => void;
};

type Options = Callbacks & {
  /** Только full: в lite и none холста нет. */
  enabled: boolean;
  section: RefObject<HTMLElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
};

/** Пауза после загрузки страницы, прежде чем тянуть остальные кадры (≈ 12 МБ). */
const BULK_DELAY_MS = 400;
const CONCURRENCY = 4;
/** Доля расстояния до целевого кадра за один кадр анимации: прокрутка догоняется мягко. */
const EASE = 0.2;
const SETTLED = 0.05;

/** Задник холста под его CSS-размер, но не крупнее кадра-источника. */
function sizeCanvas(surface: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const rect = surface.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const ratio = Math.min(window.devicePixelRatio || 1, FRAME_WIDTH / width, 1.5);
  surface.setAttribute("width", String(Math.round(width * ratio)));
  surface.setAttribute("height", String(Math.round(height * ratio)));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.imageSmoothingQuality = "high";
  return { width, height };
}

/** Кадр «по размеру обложки» с фокусом на башнях: узкий экран обрезает края, а не их. */
function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const overflow = drawWidth - width;
  const left = -Math.max(0, Math.min(overflow, drawWidth * FOCUS_X - width / 2));
  context.drawImage(image, left, (height - drawHeight) / 2, drawWidth, drawHeight);
}

/** Доля прокрутки секции: 0 — экран наверху, 1 — липкий экран доехал до низа секции. */
function progressOf(host: HTMLElement): number {
  const rect = host.getBoundingClientRect();
  const distance = rect.height - window.innerHeight;
  return distance > 0 ? clamp01(-rect.top / distance) : 0;
}

/**
 * Лента кадров по прокрутке: целевой кадр — из доли прокрутки между BUILD_START и BUILD_END,
 * текущий догоняет его с замедлением; переменные --hero-* на секции ведут синьку, вступление и
 * финал в CSS. Пока нужный кадр не загружен, рисуется ближайший готовый.
 */
class Scrubber {
  private current = 0;
  private target = 0;
  private drawn = -1;
  private size = { width: 1, height: 1 };
  private raf = 0;
  private visible = true;
  private readonly vars = new Map<string, string>();
  private readonly loader: FrameLoader;

  constructor(
    private readonly host: HTMLElement,
    private readonly surface: HTMLCanvasElement,
    private readonly context: CanvasRenderingContext2D,
    private readonly callbacks: () => Callbacks,
  ) {
    this.loader = new FrameLoader(FRAME_COUNT, frameSrc, () => this.draw(), CONCURRENCY);
  }

  start(): void {
    this.resize();
    this.loader.load(0);
    this.schedule();
  }

  startBulk(): void {
    this.loader.start();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.schedule();
  }

  resize(): void {
    this.size = sizeCanvas(this.surface, this.context);
    this.drawn = -1;
    this.draw();
    this.schedule();
  }

  readonly schedule = (): void => {
    if (!this.raf && this.visible) this.raf = requestAnimationFrame(this.update);
  };

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.loader.destroy();
  }

  private readonly update = (): void => {
    this.raf = 0;
    const progress = progressOf(this.host);
    this.target = span(progress, BUILD_START, BUILD_END) * (FRAME_COUNT - 1);
    this.current += (this.target - this.current) * EASE;
    if (Math.abs(this.target - this.current) < SETTLED) this.current = this.target;
    this.loader.prioritize(Math.round(this.current));
    this.draw();
    this.setVar("--hero-progress", progress);
    this.setVar("--hero-blueprint", 1 - span(progress, BLUEPRINT_FADE[0], BLUEPRINT_FADE[1]));
    this.setVar("--hero-intro", 1 - span(progress, INTRO_FADE[0], INTRO_FADE[1]));
    this.setVar("--hero-finale", span(progress, FINALE_FADE[0], FINALE_FADE[1]));
    this.host.classList.toggle("blueprint-hero--past-intro", progress > PAST_INTRO_AT);
    this.host.classList.toggle("blueprint-hero--finale", progress > FINALE_AT);
    this.callbacks().onFrame({ frame: this.current, progress });
    if (this.visible && this.current !== this.target) this.raf = requestAnimationFrame(this.update);
  };

  private setVar(name: string, value: number): void {
    const next = value.toFixed(3);
    if (this.vars.get(name) === next) return;
    this.vars.set(name, next);
    this.host.style.setProperty(name, next);
  }

  private draw(): void {
    const nearest = this.loader.nearest(this.current);
    if (!nearest || nearest.index === this.drawn) return;
    drawCover(this.context, nearest.image, this.size.width, this.size.height);
    const first = this.drawn < 0;
    this.drawn = nearest.index;
    if (first) this.callbacks().onDrawn();
  }
}

export function useFrameScrub({ enabled, section, canvas, onFrame, onDrawn }: Options): void {
  const callbacks = useRef<Callbacks>({ onFrame, onDrawn });
  useEffect(() => {
    callbacks.current = { onFrame, onDrawn };
  });

  useEffect(() => {
    const host = section.current;
    const surface = canvas.current;
    const context = enabled && host && surface ? surface.getContext("2d", { alpha: false }) : null;
    if (!host || !surface || !context) return;
    const scrubber = new Scrubber(host, surface, context, () => callbacks.current);
    const sizes = new ResizeObserver(() => scrubber.resize());
    const visibility = new IntersectionObserver((entries) => scrubber.setVisible(entries.some((entry) => entry.isIntersecting)));
    const timer = { id: 0 };
    const startBulk = () => {
      timer.id = window.setTimeout(() => scrubber.startBulk(), BULK_DELAY_MS);
    };
    sizes.observe(surface);
    visibility.observe(host);
    window.addEventListener("scroll", scrubber.schedule, { passive: true });
    scrubber.start();
    if (document.readyState === "complete") startBulk();
    else window.addEventListener("load", startBulk, { once: true });
    return () => {
      sizes.disconnect();
      visibility.disconnect();
      window.removeEventListener("scroll", scrubber.schedule);
      window.removeEventListener("load", startBulk);
      window.clearTimeout(timer.id);
      scrubber.destroy();
    };
  }, [enabled, section, canvas]);
}
