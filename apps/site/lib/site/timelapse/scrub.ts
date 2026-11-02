// Лента кадров по прокрутке — первый экран главной в full (как в артефакте «Vodiy House Закат»):
// секция выше экрана на --home-hero-scrub (≈ 20 px прокрутки на кадр), внутри липкий экран; доля
// прокрутки ведёт кадр полёта и стройки, гасит вступление (текст и кнопки) и проявляет финал.
// Только расчёты — без DOM.

import type { TimelapseFrameSet } from "./assets";

/** Плотнее 1,5 пикселя на CSS-пиксель задник холста не делаем. */
const MAX_CANVAS_DPR = 1.5;
/** Задник шире — кадрам 1280 пришлось бы растягиваться заметно, берём набор 1920. */
const LARGE_SET_ABOVE_PX = 1400;
const CRISP_FROM_SCALE = 0.98;

/** Набор кадров по ширине задника холста: CSS-ширина × min(DPR, 1,5). */
export function frameSetFor(cssWidth: number, dpr: number): TimelapseFrameSet {
  return cssWidth * Math.min(dpr, MAX_CANVAS_DPR) > LARGE_SET_ABOVE_PX ? 1920 : 1280;
}

/** Пикселей задника на CSS-пиксель: по экрану, но задник не шире кадра набора. */
export function canvasRatio(cssWidth: number, dpr: number, set: TimelapseFrameSet): number {
  return Math.min(dpr, set / cssWidth, MAX_CANVAS_DPR);
}

export const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/** Доля отрезка [from, to], в которой находится value: 0 до него, 1 после. */
export const span = (value: number, from: number, to: number): number =>
  clamp01((value - from) / (to - from));

export const SCRUB = {
  /** Доли прокрутки: полёт идёт 4–94 %, вступление гаснет 2–12 %, финал проявляется 88–96 %. */
  build: [0.04, 0.94],
  intro: [0.02, 0.12],
  finale: [0.88, 0.96],
  /**
   * Пороги кликов и фокуса — на середине затухания: дальше 7 % ссылки вступления не ловят фокус и
   * клики (текст уже полупрозрачный), с 92 % финал проявился наполовину и его кнопка доступна.
   */
  pastIntroAt: 0.07,
  finaleAt: 0.92,
} as const;

/** Доля прокрутки секции: 0 — экран наверху, 1 — липкий экран доехал до низа секции. */
export function scrollProgress(top: number, height: number, viewport: number): number {
  const distance = height - viewport;
  return distance > 0 ? clamp01(-top / distance) : 0;
}

/** Кадр (дробный) по доле прокрутки. */
export function frameAt(progress: number, count: number): number {
  return span(progress, SCRUB.build[0], SCRUB.build[1]) * (count - 1);
}

/**
 * Кадр «по размеру обложки» — как CSS object-fit: cover и object-position: X% 50% у постера (тот же
 * токен --home-hero-focus): холст и постер режут кадр одинаково, подмена на последнем кадре не видна.
 */
export function coverRect(
  source: { width: number; height: number },
  target: { width: number; height: number },
  positionX: number,
): { left: number; top: number; width: number; height: number } {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    left: (target.width - width) * clamp01(positionX),
    top: (target.height - height) / 2,
    width,
    height,
  };
}

/** Кадр набора: все кадры 16:9. */
const frameOfSet = (set: TimelapseFrameSet) => ({ width: set, height: (set * 9) / 16 });

/**
 * Кадр 1920 мельче окна меньше чем на 2 % (Full HD с полосой прокрутки Windows: 1905 и 1901 px): такой
 * пересчёт заметно мылит окна и фермы, поэтому кадр рисуется пиксель в пиксель, край режется чуть больше.
 * Кадр 1280 — всегда обложкой: на последнем кадре он уступает постеру, подмена не должна дёргаться.
 * target — задник в его пикселях.
 */
export function crispFit(
  set: TimelapseFrameSet,
  target: { width: number; height: number },
): boolean {
  if (set !== 1920) return false;
  const frame = frameOfSet(set);
  const scale = Math.max(target.width / frame.width, target.height / frame.height);
  return scale >= CRISP_FROM_SCALE && scale <= 1;
}

/**
 * Где на заднике рисовать кадр набора: пиксель в пиксель, если он почти 1:1, иначе обложкой. Кадр
 * черновика из другого набора растягивается на то же место: настоящий сменяет его без сдвига.
 */
export function frameRect(
  set: TimelapseFrameSet,
  target: { width: number; height: number },
  positionX: number,
): { left: number; top: number; width: number; height: number } {
  const frame = frameOfSet(set);
  if (!crispFit(set, target)) return coverRect(frame, target, positionX);
  return {
    left: Math.round((target.width - frame.width) * clamp01(positionX)),
    top: Math.round((target.height - frame.height) / 2),
    width: frame.width,
    height: frame.height,
  };
}

/** Доля из object-position («30% 50%» → 0,3); не проценты — середина. */
export function positionXOf(objectPosition: string): number {
  const match = /^\s*(-?[\d.]+)%/.exec(objectPosition);
  return match ? clamp01(Number(match[1]) / 100) : 0.5;
}
