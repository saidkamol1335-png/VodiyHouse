"use client";

import { useEffect, type RefObject } from "react";
import { getMotionTier } from "@/lib/motion";

/** Базовая ширина капли в CSS (.header-nav__drop): под пункт её подгоняет scaleX. */
const BASE = 100;
const SPRING = "cubic-bezier(0.3, 1.6, 0.5, 1)";

type Spot = { x: number; scale: number };

const spotOf = (link: HTMLElement): Spot => ({
  x: link.offsetLeft,
  scale: link.offsetWidth / BASE,
});
const poseOf = ({ x, scale }: Spot, stretch = 1, squash = 1) =>
  `translateX(${x}px) scale(${scale * stretch}, ${squash})`;

/** Перетекание: тянется вдоль пути и сплющивается, у цели — короткая рябь (только transform). */
function flow(drop: HTMLElement, from: Spot, next: Spot) {
  const stretch = 1 + Math.min(0.45, (Math.abs(next.x - from.x) / BASE) * 0.12);
  const middle = { x: (from.x + next.x) / 2, scale: (from.scale + next.scale) / 2 };
  drop.animate(
    [
      { transform: poseOf(from) },
      { transform: poseOf(middle, stretch, 0.82), offset: 0.45 },
      { transform: poseOf(next, 0.94, 1.08), offset: 0.75 },
      { transform: poseOf(next) },
    ],
    { duration: 560, easing: SPRING },
  );
}

/** Капля: moveTo(пункт) — к пункту (null — спрятать), reset() — после смены размеров. */
function createDrop(drop: HTMLElement) {
  let at: Spot | null = null;
  return {
    moveTo(link: HTMLElement | null) {
      if (!link) {
        drop.removeAttribute("data-shown");
        return;
      }
      const next = spotOf(link);
      const from = at;
      at = next;
      drop.style.transform = poseOf(next);
      const shown = drop.hasAttribute("data-shown");
      drop.setAttribute("data-shown", "");
      if (from && shown && getMotionTier() === "full" && typeof drop.animate === "function") {
        flow(drop, from, next);
      }
    },
    reset() {
      at = null;
    },
  };
}

/**
 * «Капля» меню шапки (Liquid Glass Navbar): стоит под текущим разделом, перетекает к пункту под
 * курсором или в фокусе и возвращается, когда курсор ушёл. В full — тянется в пути и садится с рябью
 * (WAAPI, только transform); в lite и none — сразу на месте. Без текущего раздела (главная) капли нет,
 * пока не наведёшь. Преломление фона капсулы — html[data-refract], только Chromium (Safari и Firefox
 * не умеют SVG-фильтр в backdrop-filter).
 */
export function useLiquidDrop(
  navRef: RefObject<HTMLElement | null>,
  dropRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const nav = navRef.current;
    const drop = dropRef.current;
    if (!nav || !drop) return;
    if ("chrome" in window) document.documentElement.setAttribute("data-refract", "");
    const bead = createDrop(drop);
    const home = () =>
      bead.moveTo(nav.querySelector<HTMLElement>('.header-nav__link[aria-current="page"]'));
    const onOver = (event: Event) => {
      const link = (event.target as Element).closest<HTMLElement>(".header-nav__link");
      if (link) bead.moveTo(link);
    };
    home();
    const events = [
      ["pointerover", onOver],
      ["focusin", onOver],
      ["pointerleave", home],
      ["focusout", home],
    ] as const;
    events.forEach(([type, handler]) => nav.addEventListener(type, handler));
    const sizes = new ResizeObserver(() => {
      bead.reset();
      home();
    });
    sizes.observe(nav);
    return () => {
      events.forEach(([type, handler]) => nav.removeEventListener(type, handler));
      sizes.disconnect();
    };
  }, [navRef, dropRef]);
}
