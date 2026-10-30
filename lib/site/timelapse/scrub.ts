// Лента кадров по прокрутке — первый экран главной в full (как в артефакте «Vodiy House Закат»):
// секция выше экрана на --home-hero-scrub (≈ 20 px прокрутки на кадр), внутри липкий экран; доля
// прокрутки ведёт кадр полёта и стройки, гасит вступление (текст и кнопки) и проявляет финал.
// Только расчёты — без DOM.

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

/** Доля из object-position («30% 50%» → 0,3); не проценты — середина. */
export function positionXOf(objectPosition: string): number {
  const match = /^\s*(-?[\d.]+)%/.exec(objectPosition);
  return match ? clamp01(Number(match[1]) / 100) : 0.5;
}
