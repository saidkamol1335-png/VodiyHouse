"use client";

import type { RefObject } from "react";
import { useMotion } from "@/lib/motion";
import { useTimelapseMode } from "./useTimelapseMode";
import { useTimelapseVideo } from "./useTimelapseVideo";

type Options = {
  /** Блок ролика: виден — ролик идёт, ушёл с экрана — стоит. */
  host: RefObject<HTMLElement | null>;
  video: RefObject<HTMLVideoElement | null>;
  /** На телефоне — вырезка 9:16 (первый экран главной); панели и карточки берут 16:9. */
  portraitOnPhone: boolean;
};

/**
 * Ролик стройки в блоке — первый экран главной, панель «Застройщикам», фон карточки «О нас»: режим из
 * tier сайта, плеер и пауза кнопкой. playing — ролик на экране (пошёл и не доиграл): тогда видна и кнопка.
 */
export function useTimelapse({ host, video, portraitOnPhone }: Options) {
  const clip = useTimelapseMode(useMotion());
  const control = useTimelapseVideo({
    enabled: clip.mode !== "none",
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
  return { mode: clip.mode, playing: clip.playing, paused: clip.paused, toggle };
}
