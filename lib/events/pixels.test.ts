import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Пиксели (3.12, ревью блока F): заглушки как у Meta и Google — объекты arguments, а не массивы;
// события до старта пикселей доходят из истории вкладки; сотруднику пиксели не грузятся.

type PixelWindow = Window & { fbq?: ((...args: unknown[]) => void) & { queue: unknown[]; callMethod?: (...args: unknown[]) => void; disablePushState?: boolean }; dataLayer?: unknown[] };

const isArguments = (value: unknown) => Object.prototype.toString.call(value) === "[object Arguments]";
const win = () => window as PixelWindow;

async function load() {
  vi.resetModules();
  const client = await import("./client");
  const pixels = await import("./pixels");
  return { ...client, ...pixels };
}

describe("пиксели рекламы", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123");
    vi.stubEnv("NEXT_PUBLIC_GA4_ID", "G-TEST");
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: () => true });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete win().fbq;
    delete win().dataLayer;
    document.head.querySelectorAll("script").forEach((script) => script.remove());
    document.cookie = "sb-x-auth-token=; max-age=0";
  });

  it("gtag и fbq кладут arguments; после загрузки fbevents.js вызовы идут в callMethod", async () => {
    const { startPixels, track } = await load();
    startPixels();
    expect(win().dataLayer!.length).toBeGreaterThan(0);
    expect(win().dataLayer!.every(isArguments)).toBe(true);
    const fbq = win().fbq!;
    expect(fbq.disablePushState).toBe(true);
    expect(fbq.queue.every(isArguments)).toBe(true);
    const callMethod = vi.fn();
    fbq.callMethod = callMethod;
    track("lead_sent", { detail: "view" });
    expect(callMethod).toHaveBeenCalledWith("track", "Lead");
  });

  it("просмотр ЖК до старта пикселей доходит до них; page_view — только Meta (GA4 считает сам)", async () => {
    const { startPixels, track } = await load();
    track("page_view");
    track("complex_view", { entity_type: "complex", entity_id: "00000000-0000-4000-8000-000000000001" });
    startPixels();
    const meta = win().fbq!.queue.map((args) => [...(args as unknown[])]);
    expect(meta).toContainEqual(["track", "PageView"]);
    expect(meta).toContainEqual(["track", "ViewContent"]);
    const ga = win().dataLayer!.map((args) => [...(args as unknown[])]);
    expect(ga.some((args) => args[0] === "event" && args[1] === "view_item")).toBe(true);
    expect(ga.some((args) => args[0] === "event" && args[1] === "page_view")).toBe(false);
  });

  it("сотрудник с сессией кабинета — пиксели не грузятся", async () => {
    document.cookie = "sb-x-auth-token=1";
    const { startPixels } = await load();
    startPixels();
    expect(win().fbq).toBeUndefined();
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });
});
