import { describe, expect, it } from "vitest";
import { MEDIA_FRAMES, clampFocus, focusCrop, objectPosition } from "./focus";

const LANDSCAPE = { width: 3000, height: 2000 }; // 3:2 — типичный рендер

describe("кадры от точки фокуса", () => {
  it("три кадра мокапа: 16:9, 4:3, 4:5", () => {
    expect(MEDIA_FRAMES.map((frame) => frame.key)).toEqual(["cover", "card", "phone"]);
  });

  it("16:9 из 3:2 режет сверху и снизу, фокус в центре — кадр по центру", () => {
    const crop = focusCrop(LANDSCAPE, 16 / 9, { x: 0.5, y: 0.5 });
    expect(crop.width).toBe(1);
    expect(crop.height).toBeCloseTo(0.84375);
    expect(crop.top).toBeCloseTo(0.078125);
    expect(objectPosition(LANDSCAPE, 16 / 9, { x: 0.5, y: 0.5 })).toBe("50% 50%");
  });

  it("фокус у края — кадр упирается в край фото, а не выходит за него", () => {
    expect(objectPosition(LANDSCAPE, 16 / 9, { x: 0.1, y: 0 })).toBe("50% 0%");
    expect(objectPosition(LANDSCAPE, 4 / 5, { x: 0.9, y: 0.5 })).toBe("100% 50%");
  });

  it("4:5 из 3:2: фокус на 30 % ширины — кадр сдвинут влево", () => {
    const crop = focusCrop(LANDSCAPE, 4 / 5, { x: 0.3, y: 0.5 });
    expect(crop.width).toBeCloseTo(0.5333, 3);
    expect(crop.left).toBeCloseTo(0.0333, 3);
    expect(objectPosition(LANDSCAPE, 4 / 5, { x: 0.3, y: 0.5 })).toBe("7.1% 50%");
  });

  it("пропорции совпадают — резать нечего", () => {
    expect(objectPosition({ width: 1600, height: 900 }, 16 / 9, { x: 0, y: 1 })).toBe("50% 50%");
  });

  it("при любом фокусе кадр внутри фото и фокус внутри кадра", () => {
    const images = [LANDSCAPE, { width: 2000, height: 3000 }, { width: 4000, height: 1000 }];
    const points = [0, 0.13, 0.5, 0.77, 1];
    for (const image of images) {
      for (const { ratio } of MEDIA_FRAMES) {
        for (const x of points) {
          for (const y of points) {
            const crop = focusCrop(image, ratio, { x, y });
            expect(crop.left).toBeGreaterThanOrEqual(0);
            expect(crop.top).toBeGreaterThanOrEqual(0);
            expect(crop.left + crop.width).toBeLessThanOrEqual(1 + 1e-9);
            expect(crop.top + crop.height).toBeLessThanOrEqual(1 + 1e-9);
            expect(x).toBeGreaterThanOrEqual(crop.left - 1e-9);
            expect(x).toBeLessThanOrEqual(crop.left + crop.width + 1e-9);
            expect(y).toBeGreaterThanOrEqual(crop.top - 1e-9);
            expect(y).toBeLessThanOrEqual(crop.top + crop.height + 1e-9);
          }
        }
      }
    }
  });

  it("точка вне фото и мусор приводятся к допустимым", () => {
    expect(clampFocus({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 });
    expect(clampFocus({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({ x: 0.5, y: 0.5 });
  });
});
