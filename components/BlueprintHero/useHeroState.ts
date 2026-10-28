"use client";

import { useCallback, useRef, useState } from "react";
import type { MotionTier } from "@/lib/motion";
import { elevationAt, STAGE_COUNT, stageOfFrame } from "./stages";
import type { HeroMode, ScrubFrame } from "./types";

/**
 * Состояние экрана: режим из tier сайта, текущий этап (состояние React — меняется редко),
 * отметка высоты — прямо в DOM через ref (меняется на каждый кадр). blocked — браузер не дал
 * запустить ролик: экран становится none с постером «Дом сдан».
 */
export function useHeroState(tier: MotionTier) {
  const elevationRef = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const onFrame = useCallback(({ frame }: ScrubFrame) => {
    const readout = elevationRef.current;
    const elevation = elevationAt(frame);
    if (readout && readout.textContent !== elevation) readout.textContent = elevation;
    setStage(stageOfFrame(frame));
  }, []);
  const onDrawn = useCallback(() => setDrawn(true), []);
  const onBlocked = useCallback(() => setBlocked(true), []);

  const mode: HeroMode = tier === "none" || blocked ? "none" : tier;
  return {
    mode,
    stage: mode === "none" ? STAGE_COUNT - 1 : stage,
    drawn,
    elevationRef,
    onFrame,
    onDrawn,
    onBlocked,
  };
}
