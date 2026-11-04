import { describe, expect, it } from "vitest";
import { portalFrames } from "./portalFrames";

const parse = (transform: string) => (transform.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("portalFrames", () => {
  const from = { x: 900, y: 300, w: 184, h: 138 };
  const frame = { w: 1216, h: 684 };
  const { outer, inner } = portalFrames(from, frame);

  it("первый кадр — прямоугольник источника, последний — весь кадр без преобразований", () => {
    expect(parse(outer[0]?.transform as string)).toEqual([900, 300, Number((184 / 1216).toFixed(5)), Number((138 / 684).toFixed(5))]);
    expect(parse(outer.at(-1)?.transform as string)).toEqual([0, 0, 1, 1]);
    expect(parse(inner.at(-1)?.transform as string)).toEqual([1, 1]);
  });

  it("картинка на экране масштабируется равномерно: sx·(k/sx) = sy·(k/sy)", () => {
    outer.forEach((keyframe, index) => {
      const [, , sx = 1, sy = 1] = parse(keyframe.transform as string);
      const [ix = 1, iy = 1] = parse(inner[index]?.transform as string);
      expect(sx * ix).toBeCloseTo(sy * iy, 3);
    });
  });

  it("смещения кадров растут монотонно от 0 до 1", () => {
    const offsets = outer.map((keyframe) => keyframe.offset as number);
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(1);
    expect(offsets.every((value, index) => index === 0 || value > (offsets[index - 1] ?? 0))).toBe(true);
  });
});
