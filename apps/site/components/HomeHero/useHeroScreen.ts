"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { REVEAL_OFF_ATTRIBUTE } from "@/lib/boot/anchorStart";
import { useMotion, type MotionTier } from "@/lib/motion";
import { STICK_QUERY } from "@/lib/site/home/heroRise";
import { finishHeroLoad, whenPreloaderGone } from "@/lib/site/timelapse/heroLoad";
import { useHeroScroll, type HeroScrollMode } from "./useHeroScroll";

/** Метка «вступление сыграно»: CSS больше не запускает его — ни при смене режима, ни при «Назад». */
const ENTERED_ATTRIBUTE = "data-entered";
/** Дольше самого длинного вступления режима. */
const INTRO_MS: Record<MotionTier, number> = { full: 2_400, lite: 1_000, none: 0 };

function subscribeStick(onChange: () => void): () => void {
  const query = window.matchMedia(STICK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Липкий экран — по тому же медиазапросу, что и CSS: раскладку решает CSS с первой отрисовки. */
function useStick(): boolean {
  return useSyncExternalStore(
    subscribeStick,
    () => window.matchMedia(STICK_QUERY).matches,
    () => false,
  );
}

/**
 * Состояние первого экрана: режим — tier сайта (full — сцена с мягким догоном прокрутки и
 * параллаксом картинок; lite — та же сцена без догона; none — готовая картина без движения), прокрутка
 * — stick на десктопе ≥ 1024×720, иначе drift. Вступление текста играет CSS сам (под экраном загрузки
 * — на паузе), хук только помечает, что оно сыграно.
 */
export function useHeroScreen({ section }: { section: RefObject<HTMLElement | null> }) {
  const tier = useMotion();
  const stick = useStick();
  const mode: HeroScrollMode = tier === "none" ? "none" : stick ? "stick" : "drift";
  useHeroScroll({ mode, smooth: tier === "full", section });
  // Рендеры спрятаны за горизонтом, первая картинка — заголовок: экрану загрузки ждать нечего.
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
