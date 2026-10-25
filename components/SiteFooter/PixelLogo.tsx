"use client";

import type { CSSProperties } from "react";
import { useReveal } from "@/lib/motion";
import { PIXEL_GRID, PIXEL_LOGO_SIZE, pixelLogo } from "./pixelGrid";

const PIXELS = pixelLogo();

/** Знак из янтарных клеток: в full клетки появляются по диагонали, когда подвал показался. */
export function PixelLogo() {
  const reveal = useReveal<SVGSVGElement>();
  return (
    <svg
      ref={reveal}
      className="site-footer__pixels"
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
          style={{ "--step": step } as CSSProperties}
        />
      ))}
    </svg>
  );
}
