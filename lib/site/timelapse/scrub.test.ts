import { describe, expect, it } from "vitest";
import { coverRect, frameAt, positionXOf, SCRUB, scrollProgress, span } from "./scrub";

describe("лента кадров по прокрутке", () => {
  it("доля прокрутки: 0 наверху, 1 когда липкий экран доехал до низа секции", () => {
    expect(scrollProgress(0, 4000, 1000)).toBe(0);
    expect(scrollProgress(-1500, 4000, 1000)).toBe(0.5);
    expect(scrollProgress(-3000, 4000, 1000)).toBe(1);
    expect(scrollProgress(-5000, 4000, 1000)).toBe(1);
    expect(scrollProgress(200, 4000, 1000)).toBe(0);
    // Секция не выше экрана (none, lite) — ленты нет.
    expect(scrollProgress(-100, 900, 1000)).toBe(0);
  });

  it("кадр: первый до начала полёта, последний после конца, между — пропорционально", () => {
    expect(frameAt(0, 180)).toBe(0);
    expect(frameAt(SCRUB.build[0], 180)).toBe(0);
    expect(frameAt(SCRUB.build[1], 180)).toBe(179);
    expect(frameAt(1, 180)).toBe(179);
    const middle = (SCRUB.build[0] + SCRUB.build[1]) / 2;
    expect(frameAt(middle, 180)).toBeCloseTo(89.5);
  });

  it("вступление гаснет раньше, чем проявляется финал; пороги кликов — на середине затухания", () => {
    expect(SCRUB.intro[1]).toBeLessThan(SCRUB.finale[0]);
    expect(span(0, SCRUB.intro[0], SCRUB.intro[1])).toBe(0);
    expect(span(SCRUB.pastIntroAt, SCRUB.intro[0], SCRUB.intro[1])).toBeCloseTo(0.5);
    expect(span(SCRUB.finaleAt, SCRUB.finale[0], SCRUB.finale[1])).toBeCloseTo(0.5);
  });

  it("обложка — как object-fit: cover и object-position X% 50% у постера", () => {
    const frame = { width: 1280, height: 720 };
    // 1440×900 (16:10): кадр по высоте, лишние 160 px по ширине режутся 30 % слева, 70 % справа.
    const desktop = coverRect(frame, { width: 1440, height: 900 }, 0.3);
    expect(desktop.width).toBe(1600);
    expect(desktop.height).toBe(900);
    expect(desktop.left).toBeCloseTo(-48);
    expect(desktop.top).toBe(0);
    // Края: 0 % — кадр прижат влево, 100 % — вправо.
    expect(coverRect(frame, { width: 1440, height: 900 }, 0).left).toBeCloseTo(0);
    expect(coverRect(frame, { width: 1440, height: 900 }, 1).left).toBeCloseTo(-160);
    // Шире 16:9 — по ширине, лишнее по высоте режется поровну.
    const wide = coverRect(frame, { width: 1920, height: 800 }, 0.3);
    expect(wide.width).toBe(1920);
    expect(wide.left).toBe(0);
    expect(wide.top).toBeCloseTo((800 - 1080) / 2);
  });

  it("доля из object-position: проценты по горизонтали, иначе середина", () => {
    expect(positionXOf("30% 50%")).toBeCloseTo(0.3);
    expect(positionXOf("64% 50%")).toBeCloseTo(0.64);
    expect(positionXOf("50% 50%")).toBeCloseTo(0.5);
    expect(positionXOf("center")).toBe(0.5);
    expect(positionXOf("")).toBe(0.5);
  });
});
