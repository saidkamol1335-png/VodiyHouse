import type { ImageSize } from "./rules";

// Кадрирование точкой фокуса (решение фазы 1, в. 4): руководитель отмечает главное на фото,
// кадры сайта считаются сами — фокус по возможности в центре кадра, кадр не выходит за фото.

/** Точка фокуса в долях фото: 0 — левый / верхний край, 1 — правый / нижний. */
export type FocusPoint = { x: number; y: number };

export const DEFAULT_FOCUS: FocusPoint = { x: 0.5, y: 0.5 };

/** Пропорции мокапа (PLAN 3а): обложка 16:9, карточка 4:3, телефон 4:5. */
export const MEDIA_FRAMES = [
  { key: "cover", ratio: 16 / 9 },
  { key: "card", ratio: 4 / 3 },
  { key: "phone", ratio: 4 / 5 },
] as const;

export type MediaFrameKey = (typeof MEDIA_FRAMES)[number]["key"];

/** Видимая часть фото в долях: left / top — начало, width / height — размер. */
export type CropRect = { left: number; top: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Почти совпадающие пропорции считаем совпадающими: иначе деление на почти ноль даёт скачки.
const FULL_SPAN = 0.999;

export function clampFocus(point: FocusPoint): FocusPoint {
  const safe = (value: number) => (Number.isFinite(value) ? clamp(value, 0, 1) : 0.5);
  return { x: safe(point.x), y: safe(point.y) };
}

export function focusCrop(image: ImageSize, frameRatio: number, focus: FocusPoint): CropRect {
  const imageRatio = image.width / image.height;
  const width = Math.min(1, frameRatio / imageRatio);
  const height = Math.min(1, imageRatio / frameRatio);
  const { x, y } = clampFocus(focus);
  return {
    left: clamp(x - width / 2, 0, 1 - width),
    top: clamp(y - height / 2, 0, 1 - height),
    width,
    height,
  };
}

/**
 * CSS object-position для object-fit: cover — тот же кадр, что focusCrop. Для cover процент
 * означает долю «лишнего» фото слева / сверху, поэтому делим начало кадра на остаток.
 */
export function objectPosition(image: ImageSize, frameRatio: number, focus: FocusPoint): string {
  const crop = focusCrop(image, frameRatio, focus);
  const percent = (start: number, span: number) =>
    span >= FULL_SPAN ? 50 : Math.round((start / (1 - span)) * 1000) / 10;
  return `${percent(crop.left, crop.width)}% ${percent(crop.top, crop.height)}%`;
}
