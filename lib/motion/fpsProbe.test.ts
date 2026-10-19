import { describe, expect, it } from "vitest";
import { averageFrameMs, tierFromFrameMs } from "./fpsProbe";

describe("averageFrameMs", () => {
  it("60 fps — около 16,7 мс", () => {
    const frames = Array.from({ length: 19 }, (_, i) => i * (1000 / 60));
    expect(averageFrameMs(frames)).toBeCloseTo(16.67, 1);
  });

  it("меньше двух кадров — бесконечность (считаем медленным)", () => {
    expect(averageFrameMs([])).toBe(Number.POSITIVE_INFINITY);
    expect(averageFrameMs([5])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("tierFromFrameMs", () => {
  it("кадр ≤ 20 мс — full", () => {
    expect(tierFromFrameMs(16.7)).toBe("full");
    expect(tierFromFrameMs(20)).toBe("full");
  });

  it("кадр > 20 мс — lite", () => {
    expect(tierFromFrameMs(20.1)).toBe("lite");
    expect(tierFromFrameMs(Number.POSITIVE_INFINITY)).toBe("lite");
  });
});
