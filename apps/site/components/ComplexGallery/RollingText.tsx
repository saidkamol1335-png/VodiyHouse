"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { getMotionTier } from "@/lib/motion";

/** expo.out GSAP ≈ cubic-bezier(.16, 1, .3, 1). */
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * RollingText Portal Carousel (@hyperiux, MIT): новое значение выезжает снизу (yPercent 110 → 0), старое
 * уходит вверх (0 → −110), 0,8 с expo.out; lite — проявление 0,3 с, none — сразу. Первый показ — без движения.
 */
export function RollingText({ value, className }: { value: string; className?: string }) {
  const [state, setState] = useState<{ current: string; previous: string | null }>({ current: value, previous: null });
  if (state.current !== value) setState({ current: value, previous: state.current });
  const current = useRef<HTMLSpanElement>(null);
  const previous = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (state.previous === null || !current.current) return;
    const tier = getMotionTier();
    if (tier === "none") {
      // Старое значение прячется сразу; анимация (а не style) — её снимет следующая смена.
      const hidden = previous.current?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 0, fill: "forwards" });
      return () => hidden?.cancel();
    }
    const quiet = tier !== "full";
    const incoming = quiet
      ? current.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" })
      : current.current.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }], { duration: 800, easing: EXPO_OUT });
    const outgoing = previous.current
      ? quiet
        ? previous.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" })
        : previous.current.animate([{ transform: "translateY(0)" }, { transform: "translateY(-110%)" }], { duration: 800, easing: EXPO_OUT, fill: "forwards" })
      : null;
    return () => {
      incoming.cancel();
      outgoing?.cancel();
    };
  }, [state]);
  return (
    <span className={["complex-gallery__roll", className].filter(Boolean).join(" ")}>
      <span ref={current} className="complex-gallery__roll-current">
        {state.current}
      </span>
      {state.previous !== null ? (
        <span ref={previous} className="complex-gallery__roll-previous" aria-hidden="true">
          {state.previous}
        </span>
      ) : null}
    </span>
  );
}
