"use client";

import { useRef, type KeyboardEvent, type RefObject } from "react";
import type { MotionTier } from "@/lib/motion";
import { useReveal } from "@/lib/motion";
import type { FlatPickerTab } from "./FlatPickerStage";
import { frameUrl } from "./frameSequence";

/**
 * Смена вкладки: выбор (aria-selected, tabIndex) — сразу, чтобы фокус и выбор не расходились при
 * быстрых стрелках; объект проявляется заново (crossfade 220 мс; none — без него).
 */
export function useTabSelect(options: {
  active: number;
  setActive: (index: number) => void;
  tier: MotionTier;
  stageRef: RefObject<HTMLElement | null>;
  sectionRef: RefObject<HTMLElement | null>;
}) {
  const { active, setActive, tier, stageRef, sectionRef } = options;
  return (index: number) => {
    if (index === active) return;
    setActive(index);
    const stage = stageRef.current;
    if (!stage || tier === "none" || typeof stage.animate !== "function") return;
    sectionRef.current?.setAttribute("data-switched", "");
    stage.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
  };
}

type TabListProps = {
  tabs: FlatPickerTab[];
  active: number;
  label: string;
  onSelect: (index: number) => void;
  onPreload: (index: number) => void;
};

/** Стрелки — по кругу, Home и End — к краям; другая клавиша — null. */
function nextTab(key: string, index: number, last: number): number | null {
  if (key === "ArrowRight") return index === last ? 0 : index + 1;
  if (key === "ArrowLeft") return index === 0 ? last : index - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

/** Вкладки: role="tablist", стрелки и Home/End, активная — tabIndex 0. */
export function FlatTabList({ tabs, active, label, onSelect, onPreload }: TabListProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTab(event.key, index, tabs.length - 1);
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onSelect(next);
  };
  return (
    <div className="flat-picker__tabs" role="tablist" aria-label={label}>
      {tabs.map((item, index) => (
        <button
          key={item.rooms}
          ref={(node) => {
            refs.current[index] = node;
          }}
          id={`flat-picker-tab-${item.rooms}`}
          type="button"
          role="tab"
          className={
            index === active ? "flat-picker__tab flat-picker__tab--active" : "flat-picker__tab"
          }
          aria-selected={index === active}
          aria-controls="flat-picker-panel"
          tabIndex={index === active ? 0 : -1}
          onClick={() => onSelect(index)}
          onKeyDown={(event) => onKey(event, index)}
          onPointerEnter={() => onPreload(index)}
          onFocus={() => onPreload(index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

type ObjectProps = {
  tab: FlatPickerTab;
  caption: string;
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

/** Объект: два кадра (lite и none) и canvas последовательности (full), подпись «Пример планировки». */
export function FlatObject({ tab, caption, stageRef, canvasRef }: ObjectProps) {
  const reveal = useReveal<HTMLDivElement>();
  const lastIndex = (mobile: boolean) =>
    (mobile ? tab.frames.mobile.count : tab.frames.desktop.count) - 1;
  const still = (index: (mobile: boolean) => number) =>
    `${frameUrl(tab.frames, true, index(true))} ${tab.frames.mobile.width}w, ${frameUrl(tab.frames, false, index(false))} ${tab.frames.desktop.width}w`;
  return (
    <div ref={stageRef} className="flat-picker__stage">
      <div className="flat-picker__object">
        <div ref={reveal} className="flat-picker__stills">
          {/* Первый кадр — сразу; 3/4 — лениво (lite и none; в full его заменяет canvas). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- кадры с прозрачным фоном уже нужного размера (scripts/frames) */}
          <img
            className="flat-picker__still flat-picker__still--top"
            srcSet={still(() => 0)}
            sizes="(max-width: 767px) 92vw, 52vw"
            alt=""
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- то же */}
          <img
            className="flat-picker__still flat-picker__still--angle"
            srcSet={still(lastIndex)}
            sizes="(max-width: 767px) 92vw, 52vw"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
        <canvas ref={canvasRef} className="flat-picker__canvas" aria-hidden />
      </div>
      <span className="flat-picker__caption">{caption}</span>
    </div>
  );
}
