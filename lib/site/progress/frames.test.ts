import { describe, expect, it } from "vitest";
import { catalogProgressOf, progressFramesFrom } from "./frames";

const photo = (path: string) => ({ path, width: 1600, height: 1200, blur: null });

describe("кадры стройки (5C.3)", () => {
  it("отчёт без фото пропускается; второй кадр карточки — первое фото и месяц отчёта", () => {
    const frames = progressFramesFrom([
      { complex_id: "a", report_id: "r1", month: "2026-10-01", published_at: "2026-10-02T07:00:00Z", block: "1", photos: [photo("x.jpg"), photo("y.jpg")] },
      { complex_id: "b", report_id: "r2", month: "2026-09-01", published_at: "2026-09-02T07:00:00Z", block: "A", photos: [] },
    ]);
    expect(frames.map((frame) => frame.complexId)).toEqual(["a"]);
    expect(catalogProgressOf(frames[0])).toEqual({
      month: "2026-10-01",
      photo: { ...photo("x.jpg"), focus: { x: 0.5, y: 0.5 }, alt: null },
    });
    expect(catalogProgressOf(undefined)).toBeNull();
    expect(progressFramesFrom(null)).toEqual([]);
  });
});
