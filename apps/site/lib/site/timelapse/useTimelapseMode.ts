"use client";

import { useCallback, useState } from "react";
import type { MotionTier } from "@/lib/motion";

/** full и lite — ролик один раз, потом постер «вечер» (тот же последний кадр); none — только постер. */
export type TimelapseMode = "full" | "lite" | "none";

/**
 * Режим ролика из tier сайта. blocked — ролика не будет (браузер не дал запустить, сеть, экономия
 * трафика): режим none с постером. playing — ролик на экране: пошёл первый кадр и ещё не доиграл;
 * ended — доиграл, дальше постер. paused — остановлен кнопкой.
 */
export function useTimelapseMode(tier: MotionTier) {
  const [blocked, setBlocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const onBlocked = useCallback(() => setBlocked(true), []);
  const onPlaying = useCallback(() => setStarted(true), []);
  const onEnded = useCallback(() => setEnded(true), []);
  const mode: TimelapseMode = tier === "none" || blocked ? "none" : tier;
  return {
    mode,
    playing: started && !ended && mode !== "none",
    paused,
    setPaused,
    onBlocked,
    onPlaying,
    onEnded,
  };
}
