/** Самый длинный шаг кадра, который учитывает сглаживание: после паузы вкладки значение не прыгает. */
const MAX_STEP_MS = 50;

/**
 * Догон значения с постоянной времени tauMs, не зависящий от частоты экрана: на 60 и 120 Гц
 * движение одинаковое (в отличие от «0,15 за кадр»).
 */
export function damp(current: number, target: number, tauMs: number, dtMs: number): number {
  if (tauMs <= 0) return target;
  const step = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
  return current + (target - current) * (1 - Math.exp(-step / tauMs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
