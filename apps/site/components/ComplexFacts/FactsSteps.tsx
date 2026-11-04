"use client";

import {
  BrickWall,
  Building2,
  CalendarCheck,
  Gem,
  LayoutGrid,
  type LucideIcon,
  MapPin,
  MoveVertical,
  PaintRoller,
  SquareParking,
} from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { type MotionTier, clamp, useMotion } from "@/lib/motion";
import type { Fact } from "@/lib/site/complex/summary";
import { stepState } from "./progress";

export type FactStep = { id: Fact["key"] | "deadline"; label: string; value: string };

const ICONS: Record<FactStep["id"], LucideIcon> = {
  class: Gem,
  floors: Building2,
  houseType: BrickWall,
  ceilings: MoveVertical,
  finishing: PaintRoller,
  parking: SquareParking,
  toCenter: MapPin,
  blocks: LayoutGrid,
  deadline: CalendarCheck,
};

/** Линия «дошли»: шаг загорается, когда его значок поднимается выше этой доли экрана. */
const REACH_LINE = 0.55;

const pad = (index: number) => String(index + 1).padStart(2, "0");

/**
 * Лента шагов «How I work» (портфолио исполнителя): по центру вертикальная линия, значки шагов на ней,
 * подписи и крупные контурные номера — по разные стороны, через шаг меняются местами. Прокрутка
 * заливает линию, дошедший шаг загорается (значок, соединитель, номер), текущий — с «лампой» и сплошным
 * номером. full — заливка следует за прокруткой, с огоньком на конце; lite — линия догоняет шаг; none и
 * без JS — все шаги пройдены. На телефоне линия слева, номеров нет.
 */
export function FactsSteps({ steps }: { steps: readonly FactStep[] }) {
  const root = useRef<HTMLDivElement>(null);
  const tier = useMotion();
  const reached = useReachedStep(root, tier);
  const active = tier === "none" ? steps.length - 1 : reached;
  return (
    <div ref={root} className="complex-facts">
      <span className="complex-facts__rail" aria-hidden="true">
        <span className="complex-facts__fill" />
        <span className="complex-facts__tip" />
      </span>
      <ol className="complex-facts__list">
        {steps.map((step, index) => (
          <Step key={step.id} step={step} index={index} active={active} />
        ))}
      </ol>
    </div>
  );
}

function Step({ step, index, active }: { step: FactStep; index: number; active: number }) {
  const Icon = ICONS[step.id];
  const number = pad(index);
  return (
    <li
      className={`complex-facts__step complex-facts__step--${index % 2 === 0 ? "left" : "right"}`}
      data-state={stepState(index, active)}
    >
      <div className="complex-facts__node" aria-hidden="true">
        <span className="complex-facts__link">
          <span className="complex-facts__link-fill" />
        </span>
        <span className="complex-facts__box">
          <Icon size={18} strokeWidth={1.6} />
          <span className="complex-facts__box-lit">
            <Icon size={18} strokeWidth={1.6} />
          </span>
        </span>
        <span className="complex-facts__lamp" />
      </div>
      <span className="complex-facts__num" aria-hidden="true">
        <span className="complex-facts__num-line">{number}</span>
        <span className="complex-facts__num-pass">{number}</span>
        <span className="complex-facts__num-fill">{number}</span>
      </span>
      <div className="complex-facts__copy">
        <p className="complex-facts__label">
          <span className="complex-facts__index" aria-hidden="true">
            {number}
          </span>
          {step.label}
        </p>
        <p className="complex-facts__value">{step.value}</p>
      </div>
    </li>
  );
}

type Parts = { rail: HTMLElement; fill: HTMLElement; tip: HTMLElement; boxes: HTMLElement[] };

const centerY = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.top + rect.height / 2;
};

/** Линия — от центра первого значка до центра последнего (ResizeObserver: шрифты, ширина, перенос строк). */
function placeRail(host: HTMLElement, { rail, boxes }: Parts) {
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  if (!first || !last) return;
  const origin = host.getBoundingClientRect().top;
  rail.style.top = `${centerY(first) - origin}px`;
  rail.style.height = `${Math.max(0, centerY(last) - centerY(first))}px`;
}

/** Кадр прокрутки: номер дошедшего шага; заливке и огоньку — только transform и opacity. */
function paintProgress({ rail, fill, tip, boxes }: Parts, tier: MotionTier): number {
  const line = window.innerHeight * REACH_LINE;
  const box = rail.getBoundingClientRect();
  const centers = boxes.map(centerY);
  const reached = centers.filter((center) => center <= line + 1).length - 1;
  const span = (y: number) => (box.height > 0 ? clamp((y - box.top) / box.height, 0, 1) : 0);
  // full — заливка за прокруткой; lite — ровно до дошедшего значка (догоняет переходом CSS).
  const progress = tier === "full" ? span(line) : reached < 0 ? 0 : span(centers[reached]!);
  fill.style.transform = `scaleY(${progress})`;
  tip.style.transform = `translateY(${progress * box.height}px)`;
  tip.style.opacity = tier === "full" && progress > 0 && progress < 1 ? "1" : "0";
  return reached;
}

/** Слежение за прокруткой, пока блок на экране; вне экрана — ничего не делает. Возвращает отписку. */
function trackSteps(
  host: HTMLElement,
  parts: Parts,
  tier: MotionTier,
  onReach: (index: number) => void,
): () => void {
  let raf = 0;
  let onScreen = false;
  const schedule = () => {
    if (raf || !onScreen) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      onReach(paintProgress(parts, tier));
    });
  };
  const resize = new ResizeObserver(() => {
    placeRail(host, parts);
    schedule();
  });
  const seen = new IntersectionObserver(([entry]) => {
    onScreen = Boolean(entry?.isIntersecting);
    schedule();
  });
  resize.observe(host);
  seen.observe(host);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    cancelAnimationFrame(raf);
    resize.disconnect();
    seen.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

/** Номер дошедшего шага (−1 — ни одного). none — без слежения: линия залита, шаги пройдены (FactsSteps). */
function useReachedStep(root: RefObject<HTMLDivElement | null>, tier: MotionTier): number {
  const [reached, setReached] = useState(-1);
  useEffect(() => {
    const host = root.current;
    const rail = host?.querySelector<HTMLElement>(".complex-facts__rail");
    const fill = host?.querySelector<HTMLElement>(".complex-facts__fill");
    const tip = host?.querySelector<HTMLElement>(".complex-facts__tip");
    if (!host || !rail || !fill || !tip) return;
    const parts: Parts = {
      rail,
      fill,
      tip,
      boxes: [...host.querySelectorAll<HTMLElement>(".complex-facts__box")],
    };
    placeRail(host, parts);
    if (tier !== "none") return trackSteps(host, parts, tier, setReached);
    fill.style.transform = "none";
    tip.style.opacity = "0";
    const place = new ResizeObserver(() => placeRail(host, parts));
    place.observe(host);
    return () => place.disconnect();
  }, [root, tier]);
  return reached;
}
