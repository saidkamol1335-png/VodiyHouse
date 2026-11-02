"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { getMotionTier } from "@/lib/motion";

export type ComplexNavItem = { id: string; label: string };

type ComplexNavProps = { label: string; items: readonly ComplexNavItem[] };

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
export function ComplexNav({ label, items }: ComplexNavProps) {
  const [lock] = useState(() => new ScrollLock());
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useActiveSection(items, lock);

  useEffect(() => {
    const link = strip.current?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    const node = strip.current;
    if (!link || !node) return;
    const left = link.offsetLeft - (node.clientWidth - link.offsetWidth) / 2;
    node.scrollTo({ left, behavior: getMotionTier() === "full" ? "smooth" : "auto" });
  }, [active]);

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    lock.hold(CLICK_LOCK_MS);
    setActive(id);
    target.scrollIntoView({
      behavior: getMotionTier() === "full" ? "smooth" : "auto",
      block: "start",
    });
    history.replaceState(null, "", `#${id}`);
  };

  if (items.length < 2) return null;
  return (
    <nav className="complex-nav" aria-label={label}>
      <div ref={strip} className="complex-nav__strip">
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
    </nav>
  );
}
