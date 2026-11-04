"use client";

import { ChevronDown } from "lucide-react";
import { type MouseEvent, type RefObject, useEffect, useRef, useState } from "react";
import { SectionsFolder } from "@/components/SectionsFolder";
import { getMotionTier } from "@/lib/motion";
import type { ComplexSectionKey } from "@/lib/site/complex/sections";

export type ComplexNavItem = { id: string; label: string; section: ComplexSectionKey };

type ComplexNavProps = { label: string; folderLabel: string; items: readonly ComplexNavItem[] };

/** Раздел «текущий», когда его верх поднялся выше этой линии от верха окна (мокап: 190 px). */
const ACTIVE_LINE = 190;
/** После клика подсветка не прыгает по разделам, мимо которых едет прокрутка (мокап: 900 мс). */
const CLICK_LOCK_MS = 900;

/** Пауза подсветки после клика: изменяемое состояние вне рендера (правило компилятора React). */
class ScrollLock {
  private until = 0;
  hold(ms: number) {
    this.until = Date.now() + ms;
  }
  get held() {
    return Date.now() < this.until;
  }
}

/** Какой раздел сейчас на экране: прокрутка — не чаще кадра. */
function useActiveSection(items: readonly ComplexNavItem[], lock: ScrollLock) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (lock.held) return;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const top = document.getElementById(item.id)?.getBoundingClientRect().top;
        if (top !== undefined && top < ACTIVE_LINE) current = item.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items, lock]);
  return [active, setActive] as const;
}

/**
 * Навигатор страницы ЖК (ТЗ 7.2, мокап .jknav; телефон — .jn): закреплён под шапкой, клик плавно
 * ведёт к разделу (в lite и none — сразу), текущий раздел подсвечен; на телефоне лента листается и
 * держит текущий пункт на виду. Без JS — обычные якорные ссылки.
 */
export function ComplexNav({ label, folderLabel, items }: ComplexNavProps) {
  const [lock] = useState(() => new ScrollLock());
  const strip = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const [active, setActive] = useActiveSection(items, lock);
  const [folder, setFolder] = useState(false);
  useFolderDismiss(nav, folder, () => setFolder(false));
  useCenterActive(strip, active);

  const go = useGoTo(lock, setActive, () => setFolder(false));

  if (items.length < 2) return null;
  return (
    <nav ref={nav} className="complex-nav" aria-label={label} onPointerLeave={(event) => event.pointerType === "mouse" && setFolder(false)}>
      <div ref={strip} className="complex-nav__strip">
        <FolderToggle label={folderLabel} open={folder} onOpen={() => setFolder(true)} onToggle={() => setFolder((value) => !value)} />
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            data-section={item.id}
            className={item.id === active ? "complex-nav__link complex-nav__link--active" : "complex-nav__link"}
            aria-current={item.id === active ? "true" : undefined}
            onClick={(event) => go(event, item.id)}
          >
            {item.label}
          </a>
        ))}
      </div>
      {folder ? (
        <div id="complex-nav-folder" className="complex-nav__folder">
          <SectionsFolder title={folderLabel} items={items} active={active} onGo={(id) => go(null, id)} />
        </div>
      ) : null}
    </nav>
  );
}

/** Переход к разделу: плавно в full, сразу в lite и none; подсветка на время прокрутки не прыгает. */
function useGoTo(lock: ScrollLock, setActive: (id: string) => void, closeFolder: () => void) {
  return (event: MouseEvent<HTMLAnchorElement> | null, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event?.preventDefault();
    closeFolder();
    lock.hold(CLICK_LOCK_MS);
    setActive(id);
    target.scrollIntoView({ behavior: getMotionTier() === "full" ? "smooth" : "auto", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };
}

/**
 * Пункт «Разделы» в начале полосы: мышь — открывает наведением, и щелчок после наведения папку не
 * закрывает; касание и клавиатура — переключают нажатием.
 */
function FolderToggle({ label, open, onOpen, onToggle }: { label: string; open: boolean; onOpen: () => void; onToggle: () => void }) {
  const pointer = useRef("");
  return (
    <button
      type="button"
      className="complex-nav__folder-toggle"
      aria-expanded={open}
      aria-controls="complex-nav-folder"
      onPointerEnter={(event) => event.pointerType === "mouse" && onOpen()}
      onPointerDown={(event) => (pointer.current = event.pointerType)}
      onClick={() => {
        if (pointer.current === "mouse") onOpen();
        else onToggle();
        pointer.current = "";
      }}
    >
      {label}
      <ChevronDown size={14} aria-hidden />
    </button>
  );
}

/** Лента держит текущий пункт посередине (телефон, узкое окно). */
function useCenterActive(strip: RefObject<HTMLDivElement | null>, active: string) {
  useEffect(() => {
    const link = strip.current?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    const node = strip.current;
    if (!link || !node) return;
    const left = link.offsetLeft - (node.clientWidth - link.offsetWidth) / 2;
    node.scrollTo({ left, behavior: getMotionTier() === "full" ? "smooth" : "auto" });
  }, [strip, active]);
}

/** Папка «Разделы» закрывается по Escape (фокус из папки возвращается на «Разделы») и нажатию вне навигатора. */
function useFolderDismiss(nav: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const folder = nav.current?.querySelector(".complex-nav__folder");
      if (folder?.contains(document.activeElement)) nav.current?.querySelector<HTMLElement>(".complex-nav__folder-toggle")?.focus();
      latest.current();
    };
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !nav.current?.contains(event.target)) latest.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [nav, open]);
}
