"use client";

import { useState, type RefObject } from "react";
import { useMotion, type MotionTier } from "@/lib/motion";
import { useTimelapseMode } from "./useTimelapseMode";
import { useTimelapseVideo } from "./useTimelapseVideo";

type Options = {
  /** Блок ролика: виден — ролик идёт, ушёл с экрана — стоит. */
  host: RefObject<HTMLElement | null>;
  video: RefObject<HTMLVideoElement | null>;
  /** На телефоне — вырезка 9:16 (первый экран главной); панели и карточки берут 16:9. */
  portraitOnPhone: boolean;
  /** В full вместо ролика — лента кадров по прокрутке (первый экран главной): ролик только в lite. */
  scrubInFull?: boolean;
};

/**
 * Ролик стройки в блоке — первый экран главной, панель «Застройщикам», фон карточки «О нас»: режим из
 * tier сайта, плеер и пауза кнопкой. playing — ролик на экране (пошёл и не доиграл): тогда видна и кнопка.
 */
export function useTimelapse({ host, video, portraitOnPhone, scrubInFull = false }: Options) {
  const clip = useTimelapseMode(useScrubTier(useMotion(), scrubInFull));
  const control = useTimelapseVideo({
    enabled: scrubInFull ? clip.mode === "lite" : clip.mode !== "none",
    host,
    video,
    portraitOnPhone,
    onPlaying: clip.onPlaying,
    onEnded: clip.onEnded,
    onBlocked: clip.onBlocked,
  });
  const toggle = () => {
    if (clip.paused) control.current?.resume();
    else control.current?.pause();
    clip.setPaused(!clip.paused);
  };
  return {
    mode: clip.mode,
    playing: clip.playing,
    paused: clip.paused,
    toggle,
    onBlocked: clip.onBlocked,
  };
}

/**
 * Лента по прокрутке вытягивает секцию на несколько экранов, поэтому включается, только если full
 * пришёл, пока страница наверху и окно не ниже первого экрана (--home-hero-min-h). Иначе место
 * читателя прыгнуло бы — перезагрузка посреди страницы, ссылка с #якорем, проба FPS решила full,
 * когда уже листают, низкое окно: в этот показ страницы — ролик, как в lite. Решение одно на показ
 * (состояние живёт и в скрытом Activity, «Назад» его не меняет).
 */
function useScrubTier(tier: MotionTier, enabled: boolean): MotionTier {
  const [scrub, setScrub] = useState<boolean | null>(null);
  if (enabled && tier === "full" && scrub === null) setScrub(canScrubHere());
  if (!enabled || tier !== "full") return tier;
  return scrub ? "full" : "lite";
}

function canScrubHere(): boolean {
  const token = getComputedStyle(document.documentElement).getPropertyValue("--home-hero-min-h");
  return window.scrollY < 1 && window.innerHeight >= (parseFloat(token) || 640);
}
