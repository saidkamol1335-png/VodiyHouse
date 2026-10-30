"use client";

import { useCallback, useState, type RefObject } from "react";
import { useTimelapse } from "@/lib/site/timelapse/useTimelapse";
import { START_PHASE, useHeroScrub, type ScrubPhase } from "./useHeroScrub";
import { useHeroOverHeader } from "./useHeroOverHeader";

type Refs = {
  section: RefObject<HTMLElement | null>;
  media: RefObject<HTMLDivElement | null>;
  video: RefObject<HTMLVideoElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
};

/**
 * Состояние первого экрана: режим из tier сайта; full — лента кадров по прокрутке (фаза и «первый кадр
 * нарисован» — состояние React, классы секции ведёт он), lite — ролик один раз с паузой кнопкой,
 * none — постер. Шапка над экраном — в его тёмных тонах.
 */
export function useHeroScreen({ section, media, video, canvas }: Refs) {
  const hero = useTimelapse({ host: media, video, portraitOnPhone: true, scrubInFull: true });
  const [drawn, setDrawn] = useState(false);
  const [phase, setPhase] = useState<ScrubPhase>(START_PHASE);
  const onDrawn = useCallback(() => setDrawn(true), []);
  const full = hero.mode === "full";
  useHeroScrub({
    enabled: full,
    section,
    canvas,
    onDrawn,
    onPhase: setPhase,
    onBlocked: hero.onBlocked,
  });
  useHeroOverHeader(section);

  const classes = ["home-hero", `home-hero--${hero.mode}`];
  if (hero.playing) classes.push("home-hero--playing");
  if (full && drawn) classes.push("home-hero--ready");
  const { stage, atEnd } = phase;
  if (full && (stage === "flight" || stage === "finale")) classes.push("home-hero--past-intro");
  if (full && stage === "finale") classes.push("home-hero--finale");
  if (full && atEnd) classes.push("home-hero--at-end");
  return { ...hero, full, className: classes.join(" ") };
}
