"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { CatalogPhoto } from "@/lib/site/catalog/records";

/** Листы папки: фото и видео месяца (из базы). */
export type FolderSheet = {
  key: string;
  name: string;
  meta: string;
  photo: CatalogPhoto | null;
};

type ProgressFolderProps = {
  /** «Октябрь 2026» — весь текст кнопки папки (на него опирается e2e). */
  label: string;
  /** «5 фото · 1 видео». */
  meta: string;
  cover: CatalogPhoto | null;
  sheets: readonly FolderSheet[];
  /** Месяц выбран (в плеере). */
  selected: boolean;
  index: number;
  panelId: string;
  onPick: () => void;
  onSheet: (key: string) => void;
};

// Геометрия Glassmorphism Folder Cards (@kedhareswer, MIT) — в пространстве 340 × 272, масштаб — stage.
const W = 340;
const H = 272;
const FRONT_H = 198;
const MAX_VISIBLE = 4;
const BACK_PATH = "M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z";
const FRONT_PATH = `M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 ${FRONT_H - 22}A22 22 0 0 1 318 ${FRONT_H}L22 ${FRONT_H}A22 22 0 0 1 0 ${FRONT_H - 22}Z`;
/** Ширина папки на 1440 и на телефоне (образец — 340; масштаб k = width / 340). */
const WIDTH = 300;
const WIDTH_PHONE = 236;

const fanSlot = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * 2 - 1);

/** FNV-1a + mulberry32 образца: детерминированный разброс листа по имени. */
function jitterOf(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 1831565813) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Папка месяца «Хода строительства» — Glassmorphism Folder Cards (@kedhareswer, MIT) один в один
 * (04.11.2026): на задней стенке — фото месяца, из-под стеклянного кармана выглядывают листы — фото и
 * видео месяца; папка клонится к курсору, под мышью «вздыхает», нажатие открывает её — листы веером;
 * нажатие на лист ставит его в плеер. Кнопка «+» образца — в варианте «без кнопки».
 */
export function ProgressFolder({ label, meta, cover, sheets, selected, index, panelId, onPick, onSheet }: ProgressFolderProps) {
  const uid = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const entered = useEntered(root, index * 140);
  useTilt(root);
  useCloseOutside(root, open, () => setOpen(false));
  const visible = sheets.slice(-MAX_VISIBLE);
  return (
    <div
      ref={root}
      className="progress-folder"
      data-open={open ? "" : undefined}
      data-entered={entered ? "" : undefined}
      style={{ "--folder-k": WIDTH / W, "--folder-k-phone": WIDTH_PHONE / W } as CSSProperties}
    >
      <div className="progress-folder__stage">
        <div className="progress-folder__tilt">
          <div className="progress-folder__shadow" aria-hidden="true" />
          <div className="progress-folder__back" style={{ clipPath: `path('${BACK_PATH}')` }} aria-hidden="true">
            {/* Стенка 364 × 296 в пространстве папки (×0,88 на 1440) — кандидат next/image под 320px. */}
            {cover ? <SitePhoto photo={cover} alt="" frame="card" sizes="320px" className="progress-folder__art" /> : null}
            <div className="progress-folder__sheen" />
          </div>
          <svg className="progress-folder__rim progress-folder__rim--back" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <path d={BACK_PATH} />
          </svg>
          <FolderFront uid={uid} label={label} meta={meta} selected={selected} open={open} panelId={panelId} onToggle={() => { setOpen((value) => !value); onPick(); }} />
          <FolderSheets sheets={visible} open={open} onSheet={onSheet} />
        </div>
      </div>
    </div>
  );
}

type FrontProps = { uid: string; label: string; meta: string; selected: boolean; open: boolean; panelId: string; onToggle: () => void };

/** Стеклянный карман: подпись внизу слева; вся стенка — кнопка месяца (текст — только «Октябрь 2026»). */
function FolderFront({ uid, label, meta, selected, open, panelId, onToggle }: FrontProps) {
  return (
    <div className="progress-folder__front" style={{ clipPath: `path('${FRONT_PATH}')` }}>
      <div className="progress-folder__tint" aria-hidden="true" />
      <div className="progress-folder__spec" aria-hidden="true" />
      <svg className="progress-folder__rim progress-folder__rim--front" viewBox={`0 0 ${W} ${FRONT_H}`} aria-hidden="true">
        <defs>
          <linearGradient id={`gf-rim-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <path d={FRONT_PATH} stroke={`url(#gf-rim-${uid})`} />
      </svg>
      <button type="button" className="progress-folder__hit" aria-pressed={selected} aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="progress-folder__title">{label}</span>
      </button>
      <span key={meta} className="progress-folder__meta" aria-hidden="true">
        {meta}
      </span>
    </div>
  );
}

/** Листы в кармане (последние 4): закрыта — выглядывают сквозь стекло, открыта — веером над папкой. */
function FolderSheets({ sheets, open, onSheet }: { sheets: readonly FolderSheet[]; open: boolean; onSheet: (key: string) => void }) {
  return (
    <div className="progress-folder__files" role="list">
      {sheets.map((sheet, i) => {
        const jitter = jitterOf(sheet.key);
        const style = {
          "--gf-slot": fanSlot(i, sheets.length),
          "--gf-depth": sheets.length - 1 - i,
          "--gf-jx": `${((jitter() - 0.5) * 10).toFixed(2)}px`,
          "--gf-jr": `${((jitter() - 0.5) * 3.2).toFixed(2)}deg`,
          zIndex: i + 1,
        } as CSSProperties;
        return (
          <div key={sheet.key} role="listitem" className="progress-folder__slot">
            <SheetShell open={open} className={sheet.photo ? "progress-folder__sheet progress-folder__sheet--art" : "progress-folder__sheet"} style={style} onClick={() => onSheet(sheet.key)}>
              {sheet.photo ? (
                <SitePhoto photo={sheet.photo} alt="" frame="card" sizes="240px" className="progress-folder__sheet-art" />
              ) : (
                <span className="progress-folder__lines" aria-hidden="true">
                  <i style={{ width: "86%" }} />
                  <i style={{ width: "92%" }} />
                  <i style={{ width: "64%" }} />
                  <i style={{ width: "88%" }} />
                  <i style={{ width: "42%" }} />
                </span>
              )}
              <span className="progress-folder__sheet-head">
                <span className="progress-folder__sheet-name">{sheet.name}</span>
                <span className="progress-folder__sheet-meta">{sheet.meta}</span>
              </span>
            </SheetShell>
          </div>
        );
      })}
    </div>
  );
}

type ShellProps = { open: boolean; className: string; style: CSSProperties; onClick: () => void; children: ReactNode };

/** Лист — кнопка только в открытой папке: в закрытой он выглядывает сквозь стекло и не нажимается. */
function SheetShell({ open, className, style, onClick, children }: ShellProps) {
  if (!open)
    return (
      <span className={className} style={style} aria-hidden="true">
        {children}
      </span>
    );
  return (
    <button type="button" className={className} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

/** Сборка при первом показе (порог 0,25), с задержкой по номеру папки — как appearDelay образца. */
function useEntered(root: React.RefObject<HTMLDivElement | null>, delay: number): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        timer = window.setTimeout(() => setEntered(true), delay);
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [root, delay]);
  return entered;
}

/** Наклон к курсору: --gf-px/--gf-py (−1…1), кадр на движение, касание не считается (как в образце). */
function useTilt(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const write = () => {
      frame = 0;
      element.style.setProperty("--gf-px", px.toFixed(3));
      element.style.setProperty("--gf-py", py.toFixed(3));
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const box = element.getBoundingClientRect();
      px = ((event.clientX - box.left) / box.width) * 2 - 1;
      py = ((event.clientY - box.top) / box.height) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(write);
    };
    const leave = () => {
      px = 0;
      py = 0;
      if (!frame) frame = requestAnimationFrame(write);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    return () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
    };
  }, [root]);
}

/** Открытая папка закрывается по Escape (фокус с листа — на кнопку месяца) и нажатию вне неё (как в образце). */
function useCloseOutside(root: React.RefObject<HTMLDivElement | null>, open: boolean, close: () => void) {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (root.current?.contains(document.activeElement)) root.current.querySelector<HTMLElement>(".progress-folder__hit")?.focus();
      latest.current();
    };
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) latest.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [root, open]);
}
