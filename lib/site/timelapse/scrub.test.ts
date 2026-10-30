import { describe, expect, it } from "vitest";
import {
  canvasRatio,
  coverRect,
  crispFit,
  frameAt,
  frameRect,
  frameSetFor,
  positionXOf,
  SCRUB,
  scrollProgress,
  span,
} from "./scrub";

describe("лента кадров: набор и задник холста", () => {
  it("набор — по ширине задника: больше 1400 px — 1920, иначе 1280", () => {
    expect(frameSetFor(1536, 1.25)).toBe(1920); // задник 1920
    expect(frameSetFor(1366, 1)).toBe(1280);
    expect(frameSetFor(1440, 1)).toBe(1920);
    expect(frameSetFor(1400, 1)).toBe(1280); // ровно 1400 — ещё нет
    expect(frameSetFor(1120, 1.25)).toBe(1280); // ровно 1400
    expect(frameSetFor(1024, 1.5)).toBe(1920);
  });

  it("DPR больше 1,5 задник не увеличивает", () => {
    expect(frameSetFor(930, 2)).toBe(1280); // 930 × 1,5 = 1395
    expect(frameSetFor(940, 2)).toBe(1920); // 940 × 1,5 = 1410
    expect(frameSetFor(930, 3)).toBe(1280);
  });

  it("ratio: по экрану, но задник не шире кадра набора и не плотнее 1,5", () => {
    expect(canvasRatio(1536, 1.25, 1920)).toBe(1.25);
    expect(canvasRatio(1366, 1, 1280)).toBeCloseTo(1280 / 1366);
    expect(canvasRatio(1440, 2, 1920)).toBeCloseTo(1920 / 1440);
    expect(canvasRatio(1000, 2, 1920)).toBe(1.5);
    expect(canvasRatio(2560, 1, 1920)).toBe(0.75);
    expect(canvasRatio(1024, 1, 1280)).toBe(1);
  });
});

describe("лента кадров: кадр почти 1:1 — пиксель в пиксель", () => {
  it("Full HD с полосой прокрутки: без пересчёта, край режется по object-position", () => {
    // 125 %: 1520,8 × 729,6 CSS — задник 1901×912.
    expect(frameRect(1920, { width: 1901, height: 912 }, 0.3)).toEqual({
      left: -6,
      top: -84,
      width: 1920,
      height: 1080,
    });
    // 100 %: 1905×950; смещение — целое, иначе кадр размылился бы на полпикселя.
    const desktop = frameRect(1920, { width: 1905, height: 950 }, 0.3);
    expect(Number.isInteger(desktop.left)).toBe(true);
    expect(desktop).toMatchObject({ top: -65, width: 1920, height: 1080 });
    // Ровно 1:1.
    expect(frameRect(1920, { width: 1920, height: 1080 }, 0.3)).toEqual({
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("дальше от 1:1 — обложка, как у постера", () => {
    const frame = { width: 1920, height: 1080 };
    const window1440 = { width: 1440, height: 900 };
    expect(frameRect(1920, window1440, 0.3)).toEqual(coverRect(frame, window1440, 0.3));
    expect(crispFit(1920, window1440)).toBe(false);
    // Кадр мельче окна на 2,1 %: край резался бы уже заметно.
    expect(crispFit(1920, { width: 1880, height: 950 })).toBe(false);
    expect(crispFit(1920, { width: 1882, height: 950 })).toBe(true);
    // Окно больше кадра: 1:1 оставил бы пустой край.
    expect(crispFit(1920, { width: 1920, height: 1081 })).toBe(false);
    expect(frameRect(1920, { width: 1920, height: 1081 }, 0.3).height).toBe(1081);
  });

  it("кадр 1280 — всегда обложкой: постеру он уступает без рывка", () => {
    const frame = { width: 1280, height: 720 };
    const narrow = { width: 1265, height: 670 };
    expect(crispFit(1280, narrow)).toBe(false);
    expect(frameRect(1280, narrow, 0.3)).toEqual(coverRect(frame, narrow, 0.3));
  });
});

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
