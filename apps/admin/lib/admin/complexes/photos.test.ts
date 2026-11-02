import { describe, expect, it } from "vitest";
import { DEFAULT_FOCUS, MEDIA_LIMITS } from "@/lib/media";
import { movePhoto, restoreOrder, worsensCover, type PhotoItem } from "./photos";

const photo = (id: string, width: number): PhotoItem => ({
  id,
  src: `/${id}.jpg`,
  width,
  height: Math.round((width * 3) / 4),
  focus: DEFAULT_FOCUS,
});

const COVER = MEDIA_LIMITS.complexCoverMinLongSide;

describe("галерея ЖК (И6)", () => {
  const big = photo("big", COVER);
  const small = photo("small", COVER - 1);
  const other = photo("other", COVER + 400);

  it("перестановка: стрелки и перетаскивание; за край — без изменений", () => {
    expect(movePhoto([big, small, other], "other", 0).map((item) => item.id)).toEqual([
      "other",
      "big",
      "small",
    ]);
    expect(movePhoto([big, small], "small", 5)).toEqual([big, small]);
  });

  it("обложку меньше 2400 px вместо годной не ставим; если обложка и так не годится — можно", () => {
    expect(worsensCover([big, small], [small, big])).toBe(true);
    expect(worsensCover([big, other], [other, big])).toBe(false);
    expect(worsensCover([small, big], [big, small])).toBe(false);
    expect(worsensCover([small, photo("tiny", 1600)], [photo("tiny", 1600), small])).toBe(false);
  });

  it("откат порядка: прежний порядок, загруженное за это время — в конце", () => {
    const fresh = photo("fresh", COVER);
    const restored = restoreOrder([small, big, fresh], ["big", "small"]);
    expect(restored.map((item) => item.id)).toEqual(["big", "small", "fresh"]);
  });
});
