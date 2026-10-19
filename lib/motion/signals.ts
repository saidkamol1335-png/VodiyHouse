// Сигналы мощности устройства (CLAUDE.md §3). Модель устройства не определяем:
// user-agent ненадёжен, а для выбора анимаций достаточно этих признаков.

export type MotionTier = "full" | "lite" | "none";

/** Итог по сигналам: «none» и «lite» окончательны, «candidate» решает проба FPS. */
export type SignalVerdict = "none" | "lite" | "candidate";

export type MotionSignals = {
  reducedMotion: boolean;
  /** navigator.deviceMemory, ГБ; нет в Safari и Firefox — тогда не учитываем. */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
  /** navigator.connection.effectiveType: slow-2g | 2g | 3g | 4g. */
  effectiveType?: string;
  coarsePointer: boolean;
  /** Мышь или тачпад: (hover: hover) and (pointer: fine). */
  finePointer: boolean;
  viewportWidth: number;
};

export const MIN_DEVICE_MEMORY_GB = 4;
export const MAX_LITE_CORES = 4;
export const PHONE_MAX_WIDTH = 768;
export const DESKTOP_MIN_WIDTH = 1024;
const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

export function decideFromSignals(signals: MotionSignals): SignalVerdict {
  if (signals.reducedMotion) return "none";
  if (signals.deviceMemory !== undefined && signals.deviceMemory < MIN_DEVICE_MEMORY_GB) {
    return "lite";
  }
  if (
    signals.hardwareConcurrency !== undefined &&
    signals.hardwareConcurrency <= MAX_LITE_CORES
  ) {
    return "lite";
  }
  if (signals.saveData) return "lite";
  if (signals.effectiveType && SLOW_CONNECTIONS.has(signals.effectiveType)) return "lite";
  if (signals.coarsePointer && signals.viewportWidth < PHONE_MAX_WIDTH) return "lite";
  if (signals.viewportWidth >= DESKTOP_MIN_WIDTH && signals.finePointer) return "candidate";
  return "lite";
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

export function readSignals(win: Window): MotionSignals {
  const nav = win.navigator as NavigatorWithHints;
  const matches = (query: string) => win.matchMedia(query).matches;
  return {
    reducedMotion: matches("(prefers-reduced-motion: reduce)"),
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    coarsePointer: matches("(pointer: coarse)"),
    finePointer: matches("(hover: hover) and (pointer: fine)"),
    viewportWidth: win.innerWidth,
  };
}
