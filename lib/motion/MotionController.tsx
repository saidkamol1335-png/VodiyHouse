"use client";

import { useEffect } from "react";
import { applyMotionTier, detectMotionTier } from "./tier";

/** Определяет режим анимации один раз после первого рендера. Ничего не рисует. */
export function MotionController() {
  useEffect(() => {
    let cancelled = false;
    detectMotionTier().then((tier) => {
      if (!cancelled) applyMotionTier(tier);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
