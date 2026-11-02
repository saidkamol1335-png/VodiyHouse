"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Низ экрана блока: полоса «Отменить» над массовой панелью. Высота дока — в переменной
 * --units-dock-h у хозяина ([data-units-dock-host]: отступ под списком, прокрутка раскрытия), а
 * сколько низа экрана он закрывает — в --units-dock-cover (липкие «Сохранить стояки» и «Создать N
 * квартир» на телефоне встают над ним) и в
 * scroll-padding страницы: строка, до которой дошли Tab, не прячется под доком (WCAG 2.4.11).
 * Без перерисовки React. В jsdom ResizeObserver нет — тогда запасная высота из токенов.
 */
export function UnitsDock({ children }: { children: ReactNode }) {
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = dock.current;
    const host = element?.closest<HTMLElement>("[data-units-dock-host]");
    if (!element || !host || typeof ResizeObserver === "undefined") return;
    const page = document.documentElement;
    const observer = new ResizeObserver(() => {
      const height = element.offsetHeight;
      const cover = height > 0 ? height + parseFloat(getComputedStyle(element).bottom) : 0;
      host.style.setProperty("--units-dock-h", `${height}px`);
      host.style.setProperty("--units-dock-cover", `${cover}px`);
      // Не больше --units-dock-cover-max: с открытым шагом панели прокрутке иначе некуда встать.
      page.style.scrollPaddingBottom =
        cover > 0
          ? `calc(min(${cover}px, var(--units-dock-cover-max)) + var(--units-dock-gap))`
          : "";
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      page.style.scrollPaddingBottom = "";
    };
  }, []);
  return (
    <div ref={dock} className="units-dock">
      {children}
    </div>
  );
}
