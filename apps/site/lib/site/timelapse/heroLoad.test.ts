// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRELOADER_ATTRIBUTE } from "@/lib/boot/preloader";

async function fresh() {
  vi.resetModules();
  return import("./heroLoad");
}

describe("heroLoad", () => {
  beforeEach(() => document.documentElement.removeAttribute(PRELOADER_ATTRIBUTE));
  afterEach(() => document.documentElement.removeAttribute(PRELOADER_ATTRIBUTE));

  it("подписка сразу получает текущую долю, дальше — только рост", async () => {
    const { onHeroLoad, reportHeroLoad } = await fresh();
    reportHeroLoad(0.25);
    const seen: number[] = [];
    onHeroLoad((share) => seen.push(share));
    reportHeroLoad(0.5);
    reportHeroLoad(0.1);
    reportHeroLoad(2);
    expect(seen).toEqual([0.25, 0.5, 1]);
  });

  it("finishHeroLoad — доля 1, отписка работает", async () => {
    const { finishHeroLoad, onHeroLoad, reportHeroLoad } = await fresh();
    const seen: number[] = [];
    const off = onHeroLoad((share) => seen.push(share));
    reportHeroLoad(0.5);
    off();
    finishHeroLoad();
    expect(seen).toEqual([0, 0.5]);
  });

  it("whenPreloaderGone ждёт снятия метки, без метки — сразу", async () => {
    const { isPreloading, whenPreloaderGone } = await fresh();
    await expect(whenPreloaderGone()).resolves.toBeUndefined();
    document.documentElement.setAttribute(PRELOADER_ATTRIBUTE, "");
    expect(isPreloading()).toBe(true);
    let gone = false;
    const waiting = whenPreloaderGone().then(() => {
      gone = true;
    });
    await Promise.resolve();
    expect(gone).toBe(false);
    document.documentElement.removeAttribute(PRELOADER_ATTRIBUTE);
    await waiting;
    expect(gone).toBe(true);
  });
});
