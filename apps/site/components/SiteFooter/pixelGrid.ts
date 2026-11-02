import { MARK_RECTS } from "@/components/Logo/markRects";

// Пиксельный знак подвала (мокап: .pixlogo): сетка 28 × 21 поверх знака 148 × 110; клетка закрашена,
// если знак покрывает больше половины её площади. Считается один раз при загрузке модуля.

export const PIXEL_GRID = { cols: 28, rows: 21, size: 5, gap: 2 } as const;
const MARK = { width: 148, height: 110 } as const;

export type Pixel = { x: number; y: number; /** Номер диагонали: по ней — задержка появления. */ step: number };

function coverage(x0: number, y0: number, width: number, height: number): number {
  return MARK_RECTS.reduce((sum, [x, y, w, h]) => {
    const overlapX = Math.max(0, Math.min(x0 + width, x + w) - Math.max(x0, x));
    const overlapY = Math.max(0, Math.min(y0 + height, y + h) - Math.max(y0, y));
    return sum + overlapX * overlapY;
  }, 0);
}

export function pixelLogo(): Pixel[] {
  const { cols, rows, size, gap } = PIXEL_GRID;
  const cellWidth = MARK.width / cols;
  const cellHeight = MARK.height / rows;
  const pixels: Pixel[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const covered = coverage(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
      if (covered / (cellWidth * cellHeight) > 0.5) {
        pixels.push({ x: col * (size + gap), y: row * (size + gap), step: row + col });
      }
    }
  }
  return pixels;
}

export const PIXEL_LOGO_SIZE = {
  width: PIXEL_GRID.cols * (PIXEL_GRID.size + PIXEL_GRID.gap) - PIXEL_GRID.gap,
  height: PIXEL_GRID.rows * (PIXEL_GRID.size + PIXEL_GRID.gap) - PIXEL_GRID.gap,
} as const;
