import { describe, expect, it } from "vitest";
import { averageFrameMs, tierFromFrameMs, waitForQuietPage } from "./fpsProbe";

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

describe("waitForQuietPage", () => {
  function fakePage(readyState: DocumentReadyState) {
    const listeners: (() => void)[] = [];
    const idle: (() => void)[] = [];
    const win = {
      document: { readyState },
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
      requestIdleCallback: (callback: () => void) => idle.push(callback),
    } as unknown as Window;
    const fire = (queue: (() => void)[]) => queue.splice(0).forEach((callback) => callback());
    return { win, load: () => fire(listeners), idle: () => fire(idle) };
  }
  const settled = async (promise: Promise<void>) => {
    let done = false;
    void promise.then(() => (done = true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return done;
  };

  it("пока страница грузится — ждёт load, затем простой", async () => {
    const page = fakePage("loading");
    const quiet = waitForQuietPage(page.win);
    page.idle();
    expect(await settled(quiet)).toBe(false);
    page.load();
    await Promise.resolve();
    expect(await settled(quiet)).toBe(false);
    page.idle();
    expect(await settled(quiet)).toBe(true);
  });

  it("страница уже загружена — ждёт только простой", async () => {
    const page = fakePage("complete");
    const quiet = waitForQuietPage(page.win);
    await Promise.resolve();
    page.idle();
    expect(await settled(quiet)).toBe(true);
  });
});
