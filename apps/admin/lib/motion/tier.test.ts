import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fpsProbe", async (importOriginal) => {
  const original = await importOriginal<typeof import("./fpsProbe")>();
  return { ...original, probeAverageFrameMs: vi.fn() };
});

import { probeAverageFrameMs } from "./fpsProbe";
import { applyMotionTier, detectMotionTier, MOTION_READY_ATTRIBUTE, MOTION_STORAGE_KEY, parseMotionOverride, whenMotionDecided } from "./tier";

type FakeOptions = {
  search?: string;
  width?: number;
  reduced?: boolean;
  finePointer?: boolean;
  cores?: number;
  saved?: string;
};

function fakeWindow(options: FakeOptions = {}): Window {
  const storage = new Map<string, string>();
  if (options.saved) storage.set(MOTION_STORAGE_KEY, options.saved);
  const media: Record<string, boolean> = {
    "(prefers-reduced-motion: reduce)": options.reduced ?? false,
    "(pointer: coarse)": !(options.finePointer ?? true),
    "(hover: hover) and (pointer: fine)": options.finePointer ?? true,
  };
  return {
    innerWidth: options.width ?? 1440,
    location: { search: options.search ?? "" },
    navigator: { hardwareConcurrency: options.cores ?? 8, deviceMemory: 8 },
    matchMedia: (query: string) => ({ matches: media[query] ?? false }),
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
  } as unknown as Window;
}

describe("parseMotionOverride", () => {
  it("понимает full, lite и none, остальное — нет", () => {
    expect(parseMotionOverride("?motion=full")).toBe("full");
    expect(parseMotionOverride("?motion=lite")).toBe("lite");
    expect(parseMotionOverride("?motion=none")).toBe("none");
    expect(parseMotionOverride("?motion=turbo")).toBeNull();
    expect(parseMotionOverride("")).toBeNull();
  });
});

describe("detectMotionTier", () => {
  beforeEach(() => vi.mocked(probeAverageFrameMs).mockReset());

  it("reduced-motion — none даже с ?motion=full", async () => {
    expect(await detectMotionTier(fakeWindow({ reduced: true, search: "?motion=full" }))).toBe("none");
  });

  it("?motion=lite на мощном десктопе — lite без пробы", async () => {
    expect(await detectMotionTier(fakeWindow({ search: "?motion=lite" }))).toBe("lite");
    expect(probeAverageFrameMs).not.toHaveBeenCalled();
  });

  it("?motion=none на мощном десктопе — none без пробы (только постер первого экрана)", async () => {
    expect(await detectMotionTier(fakeWindow({ search: "?motion=none" }))).toBe("none");
    expect(probeAverageFrameMs).not.toHaveBeenCalled();
  });

  it("телефон — lite без пробы", async () => {
    expect(await detectMotionTier(fakeWindow({ width: 390, finePointer: false }))).toBe("lite");
    expect(probeAverageFrameMs).not.toHaveBeenCalled();
  });

  it("кандидат с быстрыми кадрами — full и запоминается", async () => {
    vi.mocked(probeAverageFrameMs).mockResolvedValue(16.7);
    const win = fakeWindow();
    expect(await detectMotionTier(win)).toBe("full");
    expect(win.localStorage.getItem(MOTION_STORAGE_KEY)).toBe("full");
  });

  it("кандидат с медленными кадрами — lite", async () => {
    vi.mocked(probeAverageFrameMs).mockResolvedValue(33);
    expect(await detectMotionTier(fakeWindow())).toBe("lite");
  });

  it("сохранённый результат пробы — без повторной пробы", async () => {
    expect(await detectMotionTier(fakeWindow({ saved: "full" }))).toBe("full");
    expect(probeAverageFrameMs).not.toHaveBeenCalled();
  });
});

describe("метка «режим решён»", () => {
  it("applyMotionTier ставит метку; whenMotionDecided ждёт её или выходит по пределу", async () => {
    document.documentElement.removeAttribute(MOTION_READY_ATTRIBUTE);
    let decided = false;
    const waiting = whenMotionDecided(1000).then(() => {
      decided = true;
    });
    await Promise.resolve();
    expect(decided).toBe(false);
    applyMotionTier("lite");
    await waiting;
    expect(decided).toBe(true);
    await expect(whenMotionDecided(1000)).resolves.toBeUndefined();
    document.documentElement.removeAttribute(MOTION_READY_ATTRIBUTE);
    vi.useFakeTimers();
    const late = whenMotionDecided(50);
    vi.advanceTimersByTime(60);
    await expect(late).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
