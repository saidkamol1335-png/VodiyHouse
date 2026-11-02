import { longSideOf, type ImageSize } from "./rules";

// iOS Safari не создаёт холст больше 16,7 Мп: промежуточный шаг крупнее пропускаем.
export const MAX_CANVAS_AREA = 16_777_216;

/** Размер после уменьшения до maxLongSide по длинной стороне; маленькое не растягивается. */
export function fitWithin(size: ImageSize, maxLongSide: number): ImageSize {
  const scale = Math.min(1, maxLongSide / longSideOf(size));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Шаги уменьшения от исходника к цели — не больше чем вдвое за шаг: при сильном сжатии за
 * один раз браузер берёт не все пиксели, и на рендерах появляются «лесенки» и муар.
 * Последний шаг — всегда цель.
 */
export function downscaleSteps(
  source: ImageSize,
  target: ImageSize,
  maxArea: number = MAX_CANVAS_AREA,
): ImageSize[] {
  const steps: ImageSize[] = [target];
  for (
    let factor = 2;
    target.width * factor < source.width && target.height * factor < source.height;
    factor *= 2
  ) {
    const step = { width: target.width * factor, height: target.height * factor };
    if (step.width * step.height <= maxArea) steps.unshift(step);
  }
  return steps;
}
