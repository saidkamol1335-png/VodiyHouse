"use client";

import { useEffect, type RefObject } from "react";

/** Пока первый экран под шапкой — на <html> стоит эта метка: шапка в его тонах (SiteHeader.css). */
export const HERO_DARK_ATTRIBUTE = "data-hero-dark";

/**
 * Шапка не знает, что под ней: экран сам сообщает, пока его нижний край ниже низа шапки
 * (высота шапки — токен --header-h на :root). Проверка — в кадре после прокрутки и при изменении размера.
 */
export function useHeroOverHeader(section: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const host = section.current;
    if (!host) return;
    const root = document.documentElement;
    let raf = 0;
    let over: boolean | null = null;
    const headerHeight = () => Number.parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 0;
    const update = () => {
      raf = 0;
      const next = host.getBoundingClientRect().bottom > headerHeight();
      if (next === over) return;
      over = next;
      if (next) root.setAttribute(HERO_DARK_ATTRIBUTE, "");
      else root.removeAttribute(HERO_DARK_ATTRIBUTE);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
      root.removeAttribute(HERO_DARK_ATTRIBUTE);
    };
  }, [section]);
}
