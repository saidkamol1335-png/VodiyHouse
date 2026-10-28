// Выбор режима анимации: <html data-motion="full | lite | none">.
// Старт всегда в lite (так рендерит сервер), скрипт в <head> подставляет сохранённый режим,
// а detectMotionTier уточняет его после первого рендера.

import { probeAverageFrameMs, tierFromFrameMs, waitForQuietPage } from "./fpsProbe";
import { decideFromSignals, readSignals, type MotionTier } from "./signals";

export const MOTION_ATTRIBUTE = "data-motion";
export const MOTION_STORAGE_KEY = "vh-motion";
/** ?motion=full | lite | none — ручной переключатель для тестов, в localStorage не сохраняется. */
export const MOTION_QUERY_PARAM = "motion";
export const DEFAULT_MOTION_TIER: MotionTier = "lite";

export function parseMotionOverride(search: string): MotionTier | null {
  const value = new URLSearchParams(search).get(MOTION_QUERY_PARAM);
  return value === "full" || value === "lite" || value === "none" ? value : null;
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

/** Метка «режим решён»: до неё на <html> стартовый lite, который ещё может смениться на full. */
export const MOTION_READY_ATTRIBUTE = "data-motion-ready";

export function applyMotionTier(tier: MotionTier, doc: Document = document): void {
  doc.documentElement.setAttribute(MOTION_ATTRIBUTE, tier);
  doc.documentElement.setAttribute(MOTION_READY_ATTRIBUTE, "");
}

/**
 * Дождаться решения режима (не дольше limitMs): тяжёлое, что нужно только одному режиму (ролик
 * lite первого экрана, 4,4 МБ), не начинает грузиться, пока стартовый lite может стать full.
 */
export function whenMotionDecided(limitMs = 3000, doc: Document = document): Promise<void> {
  const root = doc.documentElement;
  if (root.hasAttribute(MOTION_READY_ATTRIBUTE)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (root.hasAttribute(MOTION_READY_ATTRIBUTE)) done();
    });
    observer.observe(root, { attributes: true, attributeFilter: [MOTION_READY_ATTRIBUTE] });
    const timer = window.setTimeout(done, limitMs);
  });
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

  await waitForQuietPage(win);
  const tier = tierFromFrameMs(await probeAverageFrameMs());
  saveTier(win, tier);
  return tier;
}
