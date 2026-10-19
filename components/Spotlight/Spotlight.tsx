"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";

type SpotlightProps = {
  children: ReactNode;
  /** Классы блока-носителя: «complex-card», «kpi»… Подсветка подмешивается миксом .spotlight. */
  className?: string;
  as?: "div" | "article" | "section" | "li";
};

/**
 * Подсветка за курсором (21st.dev в мокапе): заливка и светящийся край идут за мышью.
 * Видна только в режиме full и только с мышью — это решает CSS, компонент лишь передаёт координаты.
 */
export function Spotlight({ children, className, as: Tag = "div" }: SpotlightProps) {
  const frame = useRef(0);
  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const element = event.currentTarget;
    const { clientX, clientY } = event;
    // Не чаще кадра: pointermove приходит чаще, чем экран успевает перерисоваться.
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--spot-x", `${clientX - rect.left}px`);
      element.style.setProperty("--spot-y", `${clientY - rect.top}px`);
    });
  }, []);

  return (
    <Tag className={className ? `spotlight ${className}` : "spotlight"} onPointerMove={handlePointerMove}>
      {children}
    </Tag>
  );
}
