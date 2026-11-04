/** Прямоугольник без привязки к DOMRect — для юнитов. */
export type Box = { left: number; top: number; width: number; height: number };

export type LensPlace = {
  /** Левый верхний угол линзы от корня блока, px. */
  x: number;
  y: number;
  width: number;
  /** FLIP: откуда линза «вырастает» — смещение и масштаб карточки относительно линзы. */
  dx: number;
  dy: number;
  scale: number;
};

/** Во сколько раз линза шире карточки и её предел, px. */
const LENS_RATIO = 1.5;
const LENS_MAX = 560;
/** Не уже этого: маленькая карточка стены (200 px в наклоне) — крупная для чтения. */
const LENS_MIN = 400;
/** Линза выше карточки на столько px: верх карточки остаётся под краем линзы. */
const LENS_LIFT = 16;

/**
 * Где встаёт линза для карточки: по центру над ней, шире в 1,5 раза (≤ 560 px), не выходя за края
 * блока; dx/dy/scale — обратный сдвиг для вырастания из карточки.
 */
export function lensPlacement(card: Box, root: Box): LensPlace {
  const width = Math.min(Math.max(card.width * LENS_RATIO, LENS_MIN), LENS_MAX, root.width);
  const centered = card.left - root.left - (width - card.width) / 2;
  const x = Math.min(Math.max(centered, 0), root.width - width);
  const y = card.top - root.top - LENS_LIFT;
  return { x, y, width, dx: card.left - root.left - x, dy: LENS_LIFT, scale: card.width / width };
}

/** FLIP окна: прямоугольник from в системе to — translate и масштаб от левого верхнего угла. */
export function flipFrom(from: Box, to: Box): string {
  const scaleX = to.width ? from.width / to.width : 1;
  const scaleY = to.height ? from.height / to.height : 1;
  return `translate(${(from.left - to.left).toFixed(1)}px, ${(from.top - to.top).toFixed(1)}px) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
}
