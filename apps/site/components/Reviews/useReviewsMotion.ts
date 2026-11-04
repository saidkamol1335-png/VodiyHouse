"use client";

import { useEffect, useState, type RefObject } from "react";
import type { MotionTier } from "@/lib/motion";
import { loadGsap, refreshWhenSettled, type GsapKit } from "@/lib/site/scroll/gsap";
import { useNear } from "@/lib/site/scroll/useNear";
import type { KeyPose, KeyScene } from "./keyScene";

/** Колонка под ключ есть с 1024 px (ниже — две колонки, CSS); телефон и планшет — кадр в шапке. */
const DESKTOP = "(min-width: 1024px)";

type Refs = {
  sectionRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

function hasWebGl(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Активная строка — та, что пересекает середину экрана (full; в lite и none все яркие). */
export function useActiveRow(
  tier: MotionTier,
  sectionRef: RefObject<HTMLElement | null>,
  rows: number,
): number {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const section = sectionRef.current;
    if (tier !== "full" || !section) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.row));
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    section.querySelectorAll(".reviews__row").forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [tier, sectionRef, rows]);
  return active;
}

/**
 * 3D-ключ: только full, ≥ 1024 px и с WebGL. Three.js и сцена — динамическим импортом, когда блок в
 * одном экране от окна. Поворот ведёт GSAP ScrollTrigger (scrub) по прокрутке списка; финал — поворот
 * на 90°, как в замке, и CTA. Рендер стоит, когда сцена вне экрана или вкладка скрыта.
 */
export function useKey(tier: MotionTier, { sectionRef, canvasRef }: Refs): void {
  const near = useNear(sectionRef);
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (
      tier !== "full" ||
      !near ||
      !section ||
      !canvas ||
      !window.matchMedia(DESKTOP).matches ||
      !hasWebGl()
    )
      return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void Promise.all([import("./keyScene"), loadGsap()]).then(([{ createKeyScene }, kit]) => {
      // Блок уже на экране — включать 3D поздно: раскладка строк сменится и текст прыгнет. Остаётся кадр.
      if (cancelled || section.getBoundingClientRect().top < window.innerHeight) return;
      const pose: KeyPose = { progress: 0, lock: 0 };
      const scene = createKeyScene(canvas, () => pose);
      section.classList.add("reviews--3d");
      refreshWhenSettled(kit, section, 0);
      const parts = [
        keyScroll(kit, section, pose),
        keyRunning(scene, section, canvas),
        keyPointer(scene, section),
      ];
      cleanup = () => {
        parts.forEach((stop) => stop());
        scene.dispose();
        section.classList.remove("reviews--3d", "reviews--final");
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [tier, near, sectionRef, canvasRef]);
}

/** Поворот по прокрутке списка (scrub) и финал у CTA: ключ — в замке, кнопка появляется. */
function keyScroll({ gsap, ScrollTrigger }: GsapKit, section: HTMLElement, pose: KeyPose) {
  const turn = gsap.to(pose, {
    progress: 1,
    ease: "none",
    scrollTrigger: {
      trigger: section.querySelector(".reviews__list"),
      start: "top center",
      end: "bottom center",
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
  });
  const lock = gsap.to(pose, { lock: 1, duration: 0.9, ease: "power2.inOut", paused: true });
  const final = ScrollTrigger.create({
    trigger: section.querySelector(".reviews__cta"),
    start: "top 75%",
    onEnter: () => {
      lock.play();
      section.classList.add("reviews--final");
    },
    onLeaveBack: () => {
      lock.reverse();
      section.classList.remove("reviews--final");
    },
  });
  return () => {
    final.kill();
    lock.kill();
    turn.scrollTrigger?.kill();
    turn.kill();
  };
}

/** Размер — по канвасу; рендер — только пока сцена на экране и вкладка видна. */
function keyRunning(scene: KeyScene, section: HTMLElement, canvas: HTMLCanvasElement) {
  const sizes = new ResizeObserver(() =>
    scene.resize(Math.round(canvas.clientWidth), Math.round(canvas.clientHeight)),
  );
  sizes.observe(canvas);
  let onScreen = false;
  const sync = () => (onScreen && !document.hidden ? scene.start() : scene.stop());
  const visible = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    section.toggleAttribute("data-live", onScreen);
    sync();
  });
  visible.observe(section.querySelector(".reviews__stage")!);
  document.addEventListener("visibilitychange", sync);
  return () => {
    document.removeEventListener("visibilitychange", sync);
    visible.disconnect();
    sizes.disconnect();
    section.removeAttribute("data-live");
  };
}

/** Отклик на мышь: ±4° (сглаживает сама сцена). */
function keyPointer(scene: KeyScene, section: HTMLElement) {
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  const onPointer = (event: PointerEvent) => {
    const box = section.getBoundingClientRect();
    scene.setPointer(
      clamp(((event.clientX - box.left) / box.width) * 2 - 1),
      clamp((event.clientY / window.innerHeight) * 2 - 1),
    );
  };
  section.addEventListener("pointermove", onPointer);
  return () => section.removeEventListener("pointermove", onPointer);
}
