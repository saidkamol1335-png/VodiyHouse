import { describe, expect, it } from "vitest";
import { PIXEL_GRID, PIXEL_LOGO_SIZE, pixelLogo } from "./pixelGrid";

describe("pixelLogo", () => {
  const pixels = pixelLogo();

  it("клетки внутри сетки 28 × 21, без повторов", () => {
    const pitch = PIXEL_GRID.size + PIXEL_GRID.gap;
    expect(new Set(pixels.map(({ x, y }) => `${x}-${y}`)).size).toBe(pixels.length);
    for (const { x, y } of pixels) {
      expect(x % pitch).toBe(0);
      expect(y + PIXEL_GRID.size).toBeLessThanOrEqual(PIXEL_LOGO_SIZE.height);
    }
  });

  it("линия земли — нижний ряд закрашен целиком, верхний левый угол пуст", () => {
    const bottom = (PIXEL_GRID.rows - 1) * (PIXEL_GRID.size + PIXEL_GRID.gap);
    expect(pixels.filter(({ y }) => y === bottom)).toHaveLength(PIXEL_GRID.cols);
    expect(pixels.some(({ x, y }) => x === 0 && y === 0)).toBe(false);
  });
});
