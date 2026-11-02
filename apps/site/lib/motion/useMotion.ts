"use client";

import { useSyncExternalStore } from "react";
import type { MotionTier } from "./signals";
import { DEFAULT_MOTION_TIER, getMotionTier, MOTION_ATTRIBUTE } from "./tier";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: [MOTION_ATTRIBUTE] });
  return () => observer.disconnect();
}

/** Текущий режим анимации. Компонент знает про tier, а не про устройство. */
export function useMotion(): MotionTier {
  return useSyncExternalStore(subscribe, () => getMotionTier(), () => DEFAULT_MOTION_TIER);
}
