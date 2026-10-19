// Выбор режима анимации: <html data-motion="full | lite | none">.
// Старт всегда в lite (так рендерит сервер), скрипт в <head> подставляет сохранённый режим,
// а detectMotionTier уточняет его после первого рендера.

import { probeAverageFrameMs, tierFromFrameMs } from "./fpsProbe";
import { decideFromSignals, readSignals, type MotionTier } from "./signals";

export const MOTION_ATTRIBUTE = "data-motion";
export const MOTION_STORAGE_KEY = "vh-motion";
/** ?motion=full | lite — ручной переключатель для тестов, в localStorage не сохраняется. */
export const MOTION_QUERY_PARAM = "motion";
export const DEFAULT_MOTION_TIER: MotionTier = "lite";

export function parseMotionOverride(search: string): Exclude<MotionTier, "none"> | null {
  const value = new URLSearchParams(search).get(MOTION_QUERY_PARAM);
  return value === "full" || value === "lite" ? value : null;
}

function readSavedTier(win: Window): Exclude<MotionTier, "none"> | null {
  try {
    const value = win.localStorage.getItem(MOTION_STORAGE_KEY);
    return value === "full" || value === "lite" ? value : null;
  } catch {
    return null; // приватный режим или запрещённое хранилище
  }
}

function saveTier(win: Window, tier: MotionTier): void {
  try {
    win.localStorage.setItem(MOTION_STORAGE_KEY, tier);
  } catch {
    // без хранилища проба просто повторится в следующий раз
  }
}

export function getMotionTier(doc: Document = document): MotionTier {
  const value = doc.documentElement.getAttribute(MOTION_ATTRIBUTE);
  return value === "full" || value === "none" ? value : DEFAULT_MOTION_TIER;
}

export function applyMotionTier(tier: MotionTier, doc: Document = document): void {
  doc.documentElement.setAttribute(MOTION_ATTRIBUTE, tier);
}

/** Порядок: reduced-motion → ?motion → сигналы → сохранённый результат → проба FPS. */
export async function detectMotionTier(win: Window = window): Promise<MotionTier> {
  const verdict = decideFromSignals(readSignals(win));
  if (verdict === "none") return "none";

  const override = parseMotionOverride(win.location.search);
  if (override) return override;
  if (verdict === "lite") return "lite";

  const saved = readSavedTier(win);
  if (saved) return saved;

  const tier = tierFromFrameMs(await probeAverageFrameMs());
  saveTier(win, tier);
  return tier;
}
