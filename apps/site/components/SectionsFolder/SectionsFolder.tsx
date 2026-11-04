"use client";

import { type CSSProperties, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";
import { useMotion } from "@/lib/motion";
import type { ComplexSectionKey } from "@/lib/site/complex/sections";
import { ICONS, TILE_BACKGROUNDS, TILE_INK } from "./tiles";

export type FolderSection = { id: string; label: string; section: ComplexSectionKey };

/** Шаг веера образца — 70 px на 4 плитки; плиток больше — шаг уже, веер в ширине карточки. */
const SPREAD = 70;
const FAN_WIDTH = 300;
const EASE = "cubic-bezier(.2,.8,.2,1)";

// Формы стенок образца (clip-path: path()) — пересчёт от размера элемента; r 24, t 24, c 46.
const pathL = (w: number, h: number, r: number, t: number, tabW: number, c: number) =>
  `M0 ${r}A${r} ${r} 0 0 1 ${r} 0L${tabW} 0C${tabW + c * 0.55} 0 ${tabW + c * 0.45} ${t} ${tabW + c} ${t}L${w - r} ${t}A${r} ${r} 0 0 1 ${w} ${t + r}L${w} ${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}L${r} ${h}A${r} ${r} 0 0 1 0 ${h - r}Z`;
const pathR = (w: number, h: number, r: number, t: number, tabW: number, c: number) => {
  const x = w - tabW;
  return `M0 ${t + r}A${r} ${r} 0 0 1 ${r} ${t}L${x - c} ${t}C${x - c * 0.45} ${t} ${x - c * 0.55} 0 ${x} 0L${w - r} 0A${r} ${r} 0 0 1 ${w} ${r}L${w} ${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}L${r} ${h}A${r} ${r} 0 0 1 0 ${h - r}Z`;
};

function useShape(ref: RefObject<HTMLElement | null>, build: (w: number, h: number) => string): string {
  const [d, setD] = useState("");
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setD(build(element.offsetWidth, element.offsetHeight)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, build]);
  return d;
}

const frontPath = (w: number, h: number) => pathL(w, h, 24, 24, Math.round(w * 0.42), 46);
const backPath = (w: number, h: number) => pathR(w, h, 24, 24, Math.round(w * 0.4), 46);

type SectionsFolderProps = {
  title: string;
  items: readonly FolderSection[];
  active: string;
  onGo: (id: string) => void;
};

/**
 * Icon Folder (@romanvasnev, MIT) один в один — папка «Разделы» навигатора ЖК (04.11.2026): плитки —
 * разделы страницы (нажатие ведёт к разделу), теги — их названия. Стенки — clip-path образца, веер —
 * его формулы и тайминги; тема тёмная, как в демо образца. Анимации — переходы CSS из стилей образца.
 */
export function SectionsFolder({ title, items, active, onGo }: SectionsFolderProps) {
  const tier = useMotion();
  const reduced = tier === "none";
  const uid = useId().replace(/:/g, "");
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const open = hovered;
  const visible = shown || reduced;
  return (
    <div
      className="sections-folder"
      data-open={open ? "" : undefined}
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setActiveIndex(null);
      }}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? (open ? "translateY(-6px) scale(1.02)" : "none") : "translateY(34px) scale(.92)",
        transition: reduced ? "none" : `transform .9s ${EASE}, opacity .6s ease`,
      }}
    >
      <div className="sections-folder__glow" />
      <BackPanel panel={back} />
      <FolderFan items={items} open={open} visible={visible} reduced={reduced} activeIndex={activeIndex} setActiveIndex={setActiveIndex} onGo={onGo} />
      <FrontPanel panel={front} uid={uid} open={open} reduced={reduced}>
        <h3 className="sections-folder__title">{title}</h3>
        <FolderTags items={items} active={active} activeIndex={activeIndex} onGo={onGo} />
        <FolderPill items={items} />
      </FrontPanel>
    </div>
  );
}

/** Задняя стенка: вкладка справа, тонкий контур по форме. */
function BackPanel({ panel }: { panel: RefObject<HTMLDivElement | null> }) {
  const d = useShape(panel, backPath);
  return (
    <div ref={panel} className="sections-folder__back" style={{ clipPath: d ? `path('${d}')` : undefined }}>
      <svg className="sections-folder__edge" aria-hidden="true">
        <path d={d} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="2" />
      </svg>
    </div>
  );
}

type FrontPanelProps = { panel: RefObject<HTMLDivElement | null>; uid: string; open: boolean; reduced: boolean; children: ReactNode };

/** Передняя стеклянная стенка: вкладка слева, кромка светлеет сверху; открыта — опускается на 6 px. */
function FrontPanel({ panel, uid, open, reduced, children }: FrontPanelProps) {
  const d = useShape(panel, frontPath);
  return (
    <div
      ref={panel}
      className="sections-folder__front"
      style={{ clipPath: d ? `path('${d}')` : undefined, transform: open ? "translateY(6px)" : "none", transition: reduced ? "none" : `transform .6s ${EASE}` }}
    >
      <svg className="sections-folder__edge" aria-hidden="true">
        <defs>
          <linearGradient id={`edge-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,.38)" />
            <stop offset=".35" stopColor="rgba(255,255,255,.1)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke={`url(#edge-${uid})`} strokeWidth="2" />
      </svg>
      {children}
    </div>
  );
}

type FanProps = {
  items: readonly FolderSection[];
  open: boolean;
  visible: boolean;
  reduced: boolean;
  activeIndex: number | null;
  setActiveIndex: (update: (previous: number | null) => number | null) => void;
  onGo: (id: string) => void;
};

/** Веер плиток между стенками: дуга q²·9, поворот q·25/(n−1); открыта — шире ×1,15, поворот ×1,2. */
function FolderFan({ items, open, visible, reduced, activeIndex, setActiveIndex, onGo }: FanProps) {
  const n = items.length;
  const spread = n > 4 ? Math.min(SPREAD, FAN_WIDTH / (n - 1)) : SPREAD;
  const angleStep = n > 1 ? 25 / (n - 1) : 0;
  return (
    <div className="sections-folder__fan">
      {items.map((item, i) => {
        const q = i - (n - 1) / 2;
        const dx = open ? spread * 1.15 : spread;
        const dy = q * q * 9 - (open ? 4 : 0);
        const rot = q * angleStep * (open ? 1.2 : 1);
        const style: CSSProperties = {
          zIndex: activeIndex === i ? 5 : undefined,
          opacity: visible ? 1 : 0,
          transform: visible ? `translate3d(${q * dx}px, ${dy}px, 0) rotate(${rot}deg)` : `translate3d(${q * spread * 0.6}px, 80px, 0)`,
          transition: reduced ? "none" : `transform ${open ? 0.6 : 0.9}s ${EASE}, opacity .5s`,
          transitionDelay: reduced ? "0s" : open ? `${i * 0.04}s` : `${0.35 + i * 0.08}s`,
        };
        return (
          <div key={item.id} className="sections-folder__slot" style={style}>
            <FanTile item={item} index={i} rot={rot} activeIndex={activeIndex} reduced={reduced} setActiveIndex={setActiveIndex} onGo={onGo} />
          </div>
        );
      })}
    </div>
  );
}

type FanTileProps = {
  item: FolderSection;
  index: number;
  rot: number;
  activeIndex: number | null;
  reduced: boolean;
  setActiveIndex: FanProps["setActiveIndex"];
  onGo: (id: string) => void;
};

/** Плитка: под мышью поднимается на 26 px, выпрямляется и растёт; остальные притихают; сверху подпись. */
function FanTile({ item, index, rot, activeIndex, reduced, setActiveIndex, onGo }: FanTileProps) {
  const Icon = ICONS[item.section];
  const mine = activeIndex === index;
  return (
    <button
      type="button"
      className="sections-folder__tile"
      aria-label={item.label}
      tabIndex={-1}
      onPointerEnter={(event) => event.pointerType === "mouse" && setActiveIndex(() => index)}
      onPointerLeave={() => setActiveIndex((previous) => (previous === index ? null : previous))}
      onClick={() => onGo(item.id)}
      style={{
        transform: mine ? `translateY(-26px) rotate(${-rot}deg) scale(1.1)` : activeIndex !== null ? "scale(.96)" : "none",
        // Образец гасит соседей filter (saturate/brightness) — у нас только transform и opacity.
        opacity: activeIndex !== null && !mine ? 0.78 : 1,
        transition: reduced ? "none" : `transform .45s ${EASE}, opacity .3s ease`,
      }}
    >
      <span className="sections-folder__tile-face" style={{ background: TILE_BACKGROUNDS[index % TILE_BACKGROUNDS.length], color: TILE_INK[index % TILE_INK.length] }}>
        <Icon size={44} strokeWidth={1.75} aria-hidden />
      </span>
      <span
        className="sections-folder__label"
        style={{ opacity: mine ? 1 : 0, transform: `translateX(-50%) translateY(${mine ? 0 : 6}px)`, transition: reduced ? "none" : `opacity .25s ease, transform .35s ${EASE}` }}
      >
        {item.label}
      </span>
    </button>
  );
}

/** Теги передней стенки — названия разделов (кнопки: ссылки навигатора — его пункты); тег плитки под мышью загорается. */
function FolderTags({ items, active, activeIndex, onGo }: { items: readonly FolderSection[]; active: string; activeIndex: number | null; onGo: (id: string) => void }) {
  return (
    <div className="sections-folder__tags">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className="sections-folder__tag"
          aria-current={item.id === active ? "true" : undefined}
          data-match={activeIndex === index ? "" : undefined}
          onClick={() => onGo(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Пилюля в правом нижнем углу: плитки по 22 px (образец — до 6; больше не помещается рядом с тегами). */
const PILL_TILES = 6;

function FolderPill({ items }: { items: readonly FolderSection[] }) {
  return (
    <span className="sections-folder__pill" aria-hidden="true">
      {items.slice(0, PILL_TILES).map((item, i) => {
        const Icon = ICONS[item.section];
        return (
          <span key={item.id} className="sections-folder__pill-tile" style={{ background: TILE_BACKGROUNDS[i % TILE_BACKGROUNDS.length], color: TILE_INK[i % TILE_INK.length] }}>
            <Icon aria-hidden />
          </span>
        );
      })}
    </span>
  );
}
