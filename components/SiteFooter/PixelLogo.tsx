"use client";

import { type AnimationEvent, type CSSProperties, useState } from "react";
import { useReveal } from "@/lib/motion";
import { PIXEL_GRID, PIXEL_LOGO_SIZE, pixelLogo } from "./pixelGrid";

const PIXELS = pixelLogo();
const LAST_STEP = Math.max(...PIXELS.map(({ step }) => step));

/**
 * Знак из янтарных клеток: в full клетки появляются по диагонали, когда подвал показался. Свечение
 * (filter) — после последней клетки: под фильтром каждый кадр появления перерисовывал бы весь знак.
 */
export function PixelLogo() {
  const reveal = useReveal<SVGSVGElement>();
  const [glow, setGlow] = useState(false);
  const onAnimationEnd = (event: AnimationEvent<SVGSVGElement>) => {
    if ((event.target as SVGElement).dataset?.step === String(LAST_STEP)) setGlow(true);
  };
  return (
    <svg
      ref={reveal}
      className="site-footer__pixels"
      data-glow={glow ? "" : undefined}
      onAnimationEnd={onAnimationEnd}
      viewBox={`0 0 ${PIXEL_LOGO_SIZE.width} ${PIXEL_LOGO_SIZE.height}`}
      width={PIXEL_LOGO_SIZE.width}
      height={PIXEL_LOGO_SIZE.height}
      aria-hidden="true"
    >
      {PIXELS.map(({ x, y, step }) => (
        <rect
          key={`${x}-${y}`}
          className="site-footer__pixel"
          x={x}
          y={y}
          width={PIXEL_GRID.size}
          height={PIXEL_GRID.size}
          rx={1}
          data-step={step}
          style={{ "--step": step } as CSSProperties}
        />
      ))}
    </svg>
  );
}
