"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  TIMELAPSE_FRAMES,
  timelapseFrameSrc,
  type TimelapseFrameSet,
} from "@/lib/site/timelapse/assets";
import { FrameLoader } from "@/lib/site/timelapse/frameLoader";
import { isPreloading, reportHeroLoad } from "@/lib/site/timelapse/heroLoad";
import {
  canvasRatio,
  crispFit,
  frameAt,
  frameRect,
  frameSetFor,
  positionXOf,
  SCRUB,
  scrollProgress,
  span,
} from "@/lib/site/timelapse/scrub";
import { skipsVideo, type NetworkHints } from "@/lib/site/timelapse/useTimelapseVideo";

/**
 * Где прокрутка: вступление (текст и кнопки), полёт, финал, после — экран ушёл вверх целиком (текст и
 * ссылки вступления снова доступны: их не видно, а диктору и клавиатуре они нужны). atEnd — холст
 * уступает постеру (см. yieldsToPoster).
 */
export type ScrubPhase = { stage: "intro" | "flight" | "finale" | "after"; atEnd: boolean };

export const START_PHASE: ScrubPhase = { stage: "intro", atEnd: false };

type Callbacks = {
  /** Первый кадр нарисован — холст проявляется поверх постера. */
  onDrawn: () => void;
  /** Фаза сменилась (редко: на порогах прокрутки) — классы секции ведёт React. */
  onPhase: (phase: ScrubPhase) => void;
  /** Ленты не будет (экономия трафика) — остаётся постер. */
  onBlocked: () => void;
};

type Options = Callbacks & {
  /** Только full: в lite — ролик, в none — постер. */
  enabled: boolean;
  section: RefObject<HTMLElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
};

/** Пауза после загрузки страницы, прежде чем тянуть остальные кадры (18 или 30 МБ). */
const BULK_DELAY_MS = 400;
const CONCURRENCY = 4;
/** Черновик — всегда из лёгкого набора: экран загрузки ждёт его, и с кадрами 1920 дольше не становится. */
const DRAFT_SET: TimelapseFrameSet = 1280;
/** Доля расстояния до целевого кадра за один кадр анимации: прокрутка догоняется мягко. */
const EASE = 0.2;
const SETTLED = 0.05;
const LAST = TIMELAPSE_FRAMES.count - 1;
const VARS = ["--hero-intro", "--hero-finale"] as const;

/**
 * Экран загрузки ждёт половину черновика, начало полёта: остальные кадры догружаются при открытой
 * странице, а прокрутка пока показывает ближайший готовый (решение исполнителя 30.10: вход короче).
 */
const PRELOADER_DRAFT_SHARE = 0.5;
const reportDraft = (share: number) => reportHeroLoad(share / PRELOADER_DRAFT_SHARE);

// Кадры живут, пока жив сайт: «Назад» на главную (Next держит её в скрытом Activity) и повторный показ
// ленты не тянут их заново и не мигают пустым холстом. Загрузчик один, слушает текущая лента. Набор
// кадров выбирается один раз, с загрузчиком: смена размера окна кадры заново не тянет.
let sharedLoader: FrameLoader | null = null;
let frameSet: TimelapseFrameSet = DRAFT_SET;
let frameListener: ((index: number) => void) | null = null;

function frameLoader(surface: HTMLCanvasElement): FrameLoader {
  if (sharedLoader) return sharedLoader;
  frameSet = frameSetFor(surface.getBoundingClientRect().width, window.devicePixelRatio || 1);
  sharedLoader = new FrameLoader(
    TIMELAPSE_FRAMES.count,
    (index) => timelapseFrameSrc(frameSet, index),
    (index) => frameListener?.(index),
    CONCURRENCY,
    undefined,
    (index) => timelapseFrameSrc(DRAFT_SET, index),
  );
  sharedLoader.holdForDraft = () => isPreloading();
  return sharedLoader;
}

/** Задник холста в его пикселях. */
type Surface = { width: number; height: number; positionX: number };

/**
 * Задник холста под его размер на экране, но не крупнее кадра набора; positionX — горизонталь
 * object-position холста (тот же токен, что у постера): кадр режется так же, как постер. Размер
 * считается без округления CSS-пикселей: при масштабе экрана 125 % 729,6 CSS — это 912 пикселей, а
 * лишняя строка задника мылила бы весь кадр. Меняется, только если стал другим: присвоение width и
 * height стирает картинку.
 */
function sizeCanvas(surface: HTMLCanvasElement, context: CanvasRenderingContext2D): Surface {
  const rect = surface.getBoundingClientRect();
  const ratio = canvasRatio(Math.max(1, rect.width), window.devicePixelRatio || 1, frameSet);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (surface.width !== width) surface.width = width;
  if (surface.height !== height) surface.height = height;
  context.imageSmoothingQuality = "high";
  return { width, height, positionX: positionXOf(getComputedStyle(surface).objectPosition) };
}

function stageOf(progress: number): ScrubPhase["stage"] {
  if (progress > SCRUB.finaleAt) return "finale";
  return progress > SCRUB.pastIntroAt ? "flight" : "intro";
}

/**
 * Лента кадров по прокрутке: целевой кадр — из доли прокрутки ленты, текущий догоняет его с
 * замедлением (после старта и возврата на экран — сразу, без перемотки от первого кадра); переменные
 * --hero-intro и --hero-finale на секции гасят вступление и проявляют финал в CSS (каждый кадр
 * анимации — мимо React). Пока нужный кадр не загружен, рисуется ближайший готовый; кадр черновика
 * перерисовывается, когда придёт настоящий.
 */
class Scrubber {
  private current = 0;
  private target = 0;
  private drawn: HTMLImageElement | null = null;
  private surfaceSize: Surface = { width: 1, height: 1, positionX: 0.5 };
  /** Высота дорожки ленты (первая строка сетки секции; ниже на планшете — полоса фактов). */
  private track = 0;
  private raf = 0;
  private visible = true;
  private snap = true;
  private bulk = false;
  /** null — ещё не сообщали: первая фаза уходит в React всегда (после «Назад» там может быть чужая). */
  private phase: ScrubPhase | null = null;
  private readonly vars = new Map<string, string>();
  private readonly loader: FrameLoader;
  private readonly onFrame = (): void => {
    this.draw();
    this.schedule();
  };

  constructor(
    private readonly host: HTMLElement,
    private readonly surface: HTMLCanvasElement,
    private readonly context: CanvasRenderingContext2D,
    private readonly callbacks: () => Callbacks,
  ) {
    this.loader = frameLoader(surface);
    frameListener = this.onFrame;
  }

  start(): void {
    this.resize();
    this.target = frameAt(this.progress(), TIMELAPSE_FRAMES.count);
    this.current = this.target;
    this.loader.onDraft = reportDraft;
    reportDraft(this.loader.draftShare());
    this.loader.load(Math.round(this.target));
    this.loader.load(0);
    this.drawn = null;
    this.draw();
    this.schedule();
  }

  startBulk(): void {
    this.bulk = true;
    if (this.visible) this.loader.start();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      if (this.bulk) this.loader.start();
      this.schedule();
      return;
    }
    // Ушёл с экрана: очередь кадров ждёт, а вернётся — сразу на нужном кадре, без перемотки.
    this.loader.pause();
    this.snap = true;
    if (this.host.getBoundingClientRect().bottom <= 0)
      this.report({ stage: "after", atEnd: false });
  }

  resize(): void {
    this.surfaceSize = sizeCanvas(this.surface, this.context);
    this.track = parseFloat(getComputedStyle(this.host).gridTemplateRows) || 0;
    this.drawn = null;
    this.draw();
    this.schedule();
  }

  readonly schedule = (): void => {
    if (!this.raf && this.visible) this.raf = requestAnimationFrame(this.update);
  };

  destroy(): void {
    cancelAnimationFrame(this.raf);
    if (frameListener === this.onFrame) frameListener = null;
    this.loader.onDraft = null;
    this.loader.pause();
    for (const name of VARS) this.host.style.removeProperty(name);
  }

  private progress(): number {
    const rect = this.host.getBoundingClientRect();
    return scrollProgress(rect.top, this.track || rect.height, window.innerHeight);
  }

  private readonly update = (): void => {
    this.raf = 0;
    const progress = this.progress();
    this.target = frameAt(progress, TIMELAPSE_FRAMES.count);
    if (this.snap) this.current = this.target;
    else this.current += (this.target - this.current) * EASE;
    this.snap = false;
    if (Math.abs(this.target - this.current) < SETTLED) this.current = this.target;
    this.loader.prioritize(Math.round(this.current));
    this.draw();
    this.setVar("--hero-intro", 1 - span(progress, SCRUB.intro[0], SCRUB.intro[1]));
    this.setVar("--hero-finale", span(progress, SCRUB.finale[0], SCRUB.finale[1]));
    // Экран целиком выше окна — «после», даже если этот кадр анимации заказан до ухода с экрана.
    const after = this.host.getBoundingClientRect().bottom <= 0;
    this.report({
      stage: after ? "after" : stageOf(progress),
      atEnd: !after && this.yieldsToPoster(),
    });
    if (this.visible && this.current !== this.target) this.raf = requestAnimationFrame(this.update);
  };

  /**
   * На последнем кадре холст уступает постеру — тот же кадр крупнее. Настоящий кадр 1920 пиксель в
   * пиксель не уступает: он не мельче постера, а обрезан чуть иначе, подмена дёрнулась бы; пока он не
   * пришёл, вместо чужого кадра или черновика — постер.
   */
  private yieldsToPoster(): boolean {
    if (this.target !== LAST) return false;
    if (!crispFit(frameSet, this.surfaceSize)) return true;
    const last = this.loader.nearest(LAST);
    return last?.index !== LAST || last.image.naturalWidth !== frameSet;
  }

  private report(next: ScrubPhase): void {
    if (this.phase && next.stage === this.phase.stage && next.atEnd === this.phase.atEnd) return;
    this.phase = next;
    this.callbacks().onPhase(next);
  }

  private setVar(name: string, value: number): void {
    const next = value.toFixed(3);
    if (this.vars.get(name) === next) return;
    this.vars.set(name, next);
    this.host.style.setProperty(name, next);
  }

  private draw(): void {
    const nearest = this.loader.nearest(this.current);
    if (!nearest || nearest.image === this.drawn) return;
    const rect = frameRect(frameSet, this.surfaceSize, this.surfaceSize.positionX);
    this.context.drawImage(nearest.image, rect.left, rect.top, rect.width, rect.height);
    const first = this.drawn === null;
    this.drawn = nearest.image;
    if (first) this.callbacks().onDrawn();
  }
}

/** Лента кадров первого экрана в full: прокрутка секции ведёт полёт дрона и стройку. */
export function useHeroScrub({ enabled, section, canvas, onDrawn, onPhase, onBlocked }: Options) {
  const callbacks = useRef<Callbacks>({ onDrawn, onPhase, onBlocked });
  useEffect(() => {
    callbacks.current = { onDrawn, onPhase, onBlocked };
  });

  useEffect(() => {
    const host = section.current;
    const surface = canvas.current;
    if (!enabled || !host || !surface) return;
    const context = surface.getContext("2d", { alpha: false });
    if (skipsVideo(navigator as NetworkHints) || !context) return callbacks.current.onBlocked();
    const scrubber = new Scrubber(host, surface, context, () => callbacks.current);
    const sizes = new ResizeObserver(() => scrubber.resize());
    const visibility = new IntersectionObserver((entries) =>
      scrubber.setVisible(entries.some((entry) => entry.isIntersecting)),
    );
    const timer = { id: 0 };
    const startBulk = () => {
      timer.id = window.setTimeout(() => scrubber.startBulk(), BULK_DELAY_MS);
    };
    sizes.observe(surface);
    visibility.observe(host);
    window.addEventListener("scroll", scrubber.schedule, { passive: true });
    scrubber.start();
    // Экран загрузки ждёт черновик ленты, поэтому кадры идут сразу, а не после load страницы.
    if (isPreloading()) scrubber.startBulk();
    else if (document.readyState === "complete") startBulk();
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
