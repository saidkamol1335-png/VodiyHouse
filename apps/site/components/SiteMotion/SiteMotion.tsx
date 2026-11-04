"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { REVEAL_OFF_ATTRIBUTE } from "@/lib/boot/anchorStart";
import { getMotionTier, useMotion, usePointerEffect, type MotionTier } from "@/lib/motion";
import { createButtonPointer } from "./buttonPointer";

/**
 * Метка на <html> «вход страницы сыгран»: CSS не повторяет его при смене режима lite → full. Не на <main>:
 * страница могла ещё не ожить, и React увидел бы чужой атрибут (у <html> расхождения подавлены).
 * Новая страница снимает метку до первой отрисовки — её вход играет.
 */
const INTRO_DONE_ATTRIBUTE = "data-intro-done";
/** Дольше самого длинного входа режима (SiteMotion.css: задержка последнего пункта + длительность). */
const INTRO_MS: Record<MotionTier, number> = { full: 1_900, lite: 700, none: 0 };
/** Вспышка пламени от касания (планшет в full): кнопки-действия и мелкие кнопки шапки и страниц. */
const BURST_SELECTOR = [
  ".button:not(:disabled, .button--danger, .button--pending)",
  ".icon-button:not(.icon-button--bare)",
  ".phone-button",
  ".filter-pills__pill",
  ".segmented__item",
  ".favorite-button",
  ".share-button",
  ".complex-bar__book",
  ".complex-layout__calc:not(:disabled)",
  ".quiz__start",
  ".favorites-view__share",
].join(", ");

/**
 * Движение сайта поверх блоков (03.11.2026, «динамические анимации по всему сайту»): вход первого
 * экрана внутренних страниц играет CSS сам — здесь только метка «сыгран»; полоса прокрутки — CSS
 * (scroll-timeline); курсор над кнопкой — магнит и пламя (общий кадр курсора, только мышь и full);
 * касание — короткая вспышка пламени. Ничего не меняет в раскладке.
 */
export function SiteMotion() {
  const tier = useMotion();
  const pathname = usePathname();
  useIntroDone(pathname, tier);
  usePointerEffect(createButtonPointer);
  useFlameBurst(tier === "full");
  return <div className="site-motion__progress" aria-hidden="true" />;
}

/** «Назад» / «Вперёд»: страница уже была показана — её вход не повторяется. */
let historyStep = false;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (historyStep = true));

function useIntroDone(pathname: string, tier: MotionTier): void {
  // Режим из DOM, не из React: при гидратации React видит стартовый lite, а сохранённый full уже стоит.
  const previous = useRef<MotionTier | null>(null);
  useLayoutEffect(() => {
    if (!historyStep) document.documentElement.removeAttribute(INTRO_DONE_ATTRIBUTE);
    historyStep = false;
  }, [pathname]);
  useEffect(() => {
    const root = document.documentElement;
    const mark = () => root.setAttribute(INTRO_DONE_ATTRIBUTE, "");
    // Проба включила full, пока шёл вход lite: он уже показан — full его не переигрывает.
    const now = getMotionTier();
    const upgraded = previous.current === "lite" && now === "full";
    previous.current = now;
    if (upgraded || root.hasAttribute(REVEAL_OFF_ATTRIBUTE)) return mark();
    const timer = window.setTimeout(mark, INTRO_MS[tier]);
    return () => window.clearTimeout(timer);
  }, [pathname, tier]);
}

/** Касание кнопки — вспышка в точке касания; два имени анимации, чтобы перезапуск шёл без reflow. */
function useFlameBurst(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const burst = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>(BURST_SELECTOR);
      if (!control || !control.closest("[data-surface='site']")) return;
      const box = control.getBoundingClientRect();
      control.style.setProperty("--flame-dx", `${(event.clientX - box.left - box.width / 2).toFixed(1)}px`);
      control.dataset.flame = control.dataset.flame === "a" ? "b" : "a";
    };
    document.addEventListener("pointerdown", burst, { passive: true });
    return () => document.removeEventListener("pointerdown", burst);
  }, [on]);
}
