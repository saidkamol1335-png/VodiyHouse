import { describe, expect, it } from "vitest";
import { progressMonthsFrom } from "./months";
import type { ProgressReport } from "./records";

const photo = (path: string) => ({ path, width: 1600, height: 900, blur: null, focus: { x: 0.5, y: 0.5 } });
const report = (id: string, month: string, photos: string[], video = false): ProgressReport =>
  ({
    id,
    isUnit: false,
    month,
    shotAt: `${month}T10:00:00Z`,
    comment: { ru: "", uz: "" },
    youtubeId: video ? "abc" : null,
    videoPath: null,
    block: null,
    photos: photos.map(photo),
  }) as unknown as ProgressReport;

describe("progressMonthsFrom", () => {
  it("два блока в одном месяце — одна папка, два отчёта, счёт фото и видео", () => {
    const months = progressMonthsFrom([
      report("a", "2026-10-01", ["a1", "a2"]),
      report("b", "2026-10-01", ["b1"], true),
      report("c", "2026-09-01", ["c1"]),
    ]);
    expect(months.map((item) => item.month)).toEqual(["2026-10-01", "2026-09-01"]);
    const [october] = months;
    expect(october?.reports.map((item) => item.id)).toEqual(["a", "b"]);
    expect(october?.photos).toBe(3);
    expect(october?.videos).toBe(1);
    expect(october?.peek.map((item) => item.path)).toEqual(["a1", "b1", "a2"]);
  });

  it("не больше шести месяцев", () => {
    const many = Array.from({ length: 8 }, (_, index) => report(String(index), `2026-0${index + 1}-01`, []));
    expect(progressMonthsFrom(many)).toHaveLength(6);
  });
});
