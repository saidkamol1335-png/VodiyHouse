"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { MotionTier } from "@/lib/motion";
import { keepPlaceAbove, loadGsap, refreshWhenSettled, type GsapKit } from "@/lib/site/scroll/gsap";
import { useNear } from "@/lib/site/scroll/useNear";
import type { FlatPickerTab } from "./FlatPickerStage";
import { FrameSequence } from "./frameSequence";

type Options = {
  tier: MotionTier;
  tabs: FlatPickerTab[];
  active: number;
  sectionRef: RefObject<HTMLElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

type Turn = { turn: number };

const MOBILE = "(max-width: 767px)";
const MAX_DPR = 2;

/**
 * Движение секции в full: кадры на canvas (useFrames) и прокрутка (useFlatScroll). Возвращает
 * подгрузку кадров вкладки по наведению или фокусу.
 */
export function useFlatMotion({ tier, tabs, active, sectionRef, stageRef, canvasRef }: Options) {
  const turn = useRef<Turn>({ turn: 0 });
  const { draw, preload } = useFrames(
    { tier, tabs, active, sectionRef, stageRef, canvasRef },
    turn,
  );
  useFlatScroll(tier, sectionRef, stageRef, turn, draw);
  return preload;
}

/**
 * Кадры: первый — сразу, остальные — когда секция в одном экране, другие вкладки — по наведению/фокусу
 * или в простое; рисуются только при смене доли (rAF), DPR ≤ 2.
 */
function useFrames(
  { tier, tabs, active, sectionRef, stageRef, canvasRef }: Options,
  turn: RefObject<Turn>,
) {
  const sequences = useRef<FrameSequence[]>([]);
  const activeRef = useRef(active);
  const frame = useRef(0);
  const near = useNear(sectionRef);
  const nearRef = useRef(near);

  const draw = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const context = canvasRef.current?.getContext("2d");
      const sequence = sequences.current[activeRef.current];
      if (context && sequence) sequence.draw(context, turn.current.turn);
    });
  }, [canvasRef, turn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (tier !== "full" || !canvas || !stage) return;
    const mobile = window.matchMedia(MOBILE).matches;
    sequences.current = tabs.map((tab) => new FrameSequence(tab.frames, mobile, draw));
    sequences.current[activeRef.current]?.loadFirst();
    if (nearRef.current) sequences.current[activeRef.current]?.loadAll();
    const observer = new ResizeObserver(() => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const box = stage.getBoundingClientRect();
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
      draw();
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      sequences.current = [];
    };
  }, [tier, tabs, stageRef, canvasRef, draw]);

  const preload = useFrameLoading({ tier, near, active, sequences, activeRef, nearRef, draw });
  return { draw, preload };
}

type Loading = {
  tier: MotionTier;
  near: boolean;
  active: number;
  sequences: RefObject<FrameSequence[]>;
  activeRef: RefObject<number>;
  nearRef: RefObject<boolean>;
  draw: () => void;
};

/** Подошли к секции: кадры текущей вкладки, остальные — в простое; смена вкладки — её кадры. */
function useFrameLoading({ tier, near, active, sequences, activeRef, nearRef, draw }: Loading) {
  useEffect(() => {
    nearRef.current = near;
    if (!near || tier !== "full") return;
    sequences.current[activeRef.current]?.loadAll();
    const idle =
      window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => sequences.current.forEach((sequence) => sequence.loadAll()));
    return () => cancel(handle);
  }, [near, tier, sequences, activeRef, nearRef]);

  useEffect(() => {
    activeRef.current = active;
    if (nearRef.current) sequences.current[active]?.loadAll();
    else sequences.current[active]?.loadFirst();
    draw();
  }, [active, draw, sequences, activeRef, nearRef]);

  return (index: number) => {
    if (nearRef.current) sequences.current[index]?.loadAll();
  };
}

function useFlatScroll(
  tier: MotionTier,
  sectionRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
  turn: RefObject<Turn>,
  draw: () => void,
) {
  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (tier !== "full" || !section || !stage) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    loadGsap()
      .then((kit) => {
        if (cancelled) return;
        keepPlaceAbove(kit, section, () => {
          revert = scrollScene(kit, section, stage, turn.current, draw);
        });
      })
      .catch(() => section.classList.add("flat-picker--static"));
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [tier, sectionRef, stageRef, turn, draw]);
}

/**
 * Прокрутка (gsap.matchMedia): десктоп — pin ≈ 250svh; телефон — без pin, поворот, пока сцена проходит
 * экран. Пересчёт ScrollTrigger (resize, загрузка) проигрывает анимацию с нуля и возвращает прогресс
 * без событий: колбэк запомнил бы 0. Поэтому state общий с рисунком, а перерисовка — на каждое
 * обновление и после пересчёта.
 */
function scrollScene(
  kit: GsapKit,
  section: HTMLElement,
  stage: HTMLElement,
  state: Turn,
  draw: () => void,
) {
  const mm = kit.gsap.matchMedia();
  section.classList.add("flat-picker--live");
  kit.ScrollTrigger.addEventListener("refresh", draw);
  mm.add({ desktop: "(min-width: 768px)", mobile: MOBILE }, (context) => {
    const { desktop } = context.conditions as { desktop: boolean };
    return desktop
      ? pinnedScene(kit, section, stage, state, draw)
      : phoneScene(kit, section, stage, state, draw);
  });
  refreshWhenSettled(kit, section, 1);
  return () => {
    kit.ScrollTrigger.removeEventListener("refresh", draw);
    mm.revert();
    section.classList.remove("flat-picker--live");
  };
}

function phoneScene(
  { gsap }: GsapKit,
  section: HTMLElement,
  stage: HTMLElement,
  state: Turn,
  draw: () => void,
) {
  section.style.setProperty("--fp-reveal", "1");
  gsap.to(state, {
    turn: 1,
    ease: "none",
    onUpdate: draw,
    scrollTrigger: { trigger: stage, start: "top 90%", end: "bottom 35%", scrub: 0.4 },
  });
  return () => section.style.removeProperty("--fp-reveal");
}

/** 0–60 %: объект опускается, растёт и поворачивается, вордмарк уменьшается; 60–100 %: --fp-reveal. */
function pinnedScene(
  { gsap }: GsapKit,
  section: HTMLElement,
  stage: HTMLElement,
  state: Turn,
  draw: () => void,
) {
  const pin = section.querySelector<HTMLElement>(".flat-picker__pin")!;
  section.classList.add("flat-picker--pinned");
  const timeline = gsap.timeline({
    defaults: { ease: "none" },
    onUpdate: draw,
    scrollTrigger: {
      trigger: pin,
      pin: true,
      start: "top top",
      end: "+=150%",
      scrub: 0.6,
      invalidateOnRefresh: true,
      onToggle: (self) => section.toggleAttribute("data-live", self.isActive),
    },
  });
  timeline
    .to(state, { turn: 1, duration: 0.6 }, 0)
    .fromTo(
      stage.querySelector(".flat-picker__object"),
      { yPercent: -26, scale: 0.84 },
      { yPercent: 0, scale: 1, duration: 0.6, ease: "power1.inOut" },
      0,
    )
    .fromTo(
      section.querySelector(".flat-picker__wordmark"),
      { scale: 1, yPercent: 0 },
      { scale: 0.75, yPercent: -10, duration: 0.6, ease: "power1.inOut" },
      0,
    )
    .fromTo(section, { "--fp-reveal": 0 }, { "--fp-reveal": 1, duration: 0.4 }, 0.6);
  const onFocus = focusToShown(timeline);
  pin.addEventListener("focusin", onFocus);
  return () => {
    pin.removeEventListener("focusin", onFocus);
    section.classList.remove("flat-picker--pinned");
    section.removeAttribute("data-live");
  };
}

/**
 * Фокус во вкладки или текст, пока они не проявились: страница — к концу закреплённого пути, где
 * видно всё (кнопки и фичи проявляются последними).
 */
function focusToShown(timeline: gsap.core.Timeline) {
  return () => {
    const trigger = timeline.scrollTrigger;
    if (!trigger || trigger.progress >= 0.999) return;
    window.scrollTo({ top: trigger.end - 1, behavior: "instant" });
  };
}
