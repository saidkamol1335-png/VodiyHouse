"use client";

import { useEffect, type RefObject } from "react";
import { REVEAL_OFF_ATTRIBUTE } from "@/lib/boot/anchorStart";
import { useMotion, type MotionTier } from "@/lib/motion";
import { finishHeroLoad, whenPreloaderGone } from "@/lib/site/timelapse/heroLoad";

/** Метка «вступление сыграно»: CSS больше не запускает его — ни при смене режима, ни при «Назад». */
const ENTERED_ATTRIBUTE = "data-entered";
/** Дольше самого длинного вступления режима. */
const INTRO_MS: Record<MotionTier, number> = { full: 2_400, lite: 1_000, none: 0 };

/**
 * Состояние первого экрана: режим — tier сайта (full и lite — короткое вступление текста и рамок,
 * none — готовая картина). Рендеры и цифры видны сразу, прокрутка их не двигает (правки 15.11, п. 1;
 * сцена «Раскол» убрана). Вступление играет CSS (под экраном загрузки — на паузе), хук только помечает,
 * что оно сыграно.
 */
export function useHeroScreen({ section }: { section: RefObject<HTMLElement | null> }) {
  const tier = useMotion();
  // Экран загрузки рендеры не ждёт: первая картинка — заголовок, рамки грузятся следом.
  useEffect(() => finishHeroLoad(), []);
  useIntroDone(section, tier);
  return { mode: tier, full: tier === "full", className: `home-hero home-hero--${tier}` };
}

/** Вступление сыграно (экран загрузки ушёл и прошло его время) — метка на секции. */
function useIntroDone(section: RefObject<HTMLElement | null>, tier: MotionTier): void {
  useEffect(() => {
    const host = section.current;
    if (!host || host.hasAttribute(ENTERED_ATTRIBUTE)) return;
    const done = () => host.setAttribute(ENTERED_ATTRIBUTE, "");
    if (document.documentElement.hasAttribute(REVEAL_OFF_ATTRIBUTE)) return done();
    let timer = 0;
    let cancelled = false;
    void whenPreloaderGone().then(() => {
      if (!cancelled) timer = window.setTimeout(done, INTRO_MS[tier]);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [section, tier]);
}
