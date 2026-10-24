"use client";

import { useEffect, useRef, useState } from "react";

type BeamProps = {
  /** Микс с элементом блока-владельца по БЭМ: место задаёт его CSS. */
  className?: string;
};

/**
 * Луч по рамке карточки (мокап: .beam) — карточка входа и итог /kalkulyator; только в full
 * (CLAUDE.md §3). Вне экрана вращение на паузе: не тратим кадры на невидимое.
 */
export function Beam({ className }: BeamProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const target = ref.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry?.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return (
    <span
      ref={ref}
      className={className ? `beam ${className}` : "beam"}
      data-paused={offscreen ? "" : undefined}
      aria-hidden="true"
    />
  );
}
