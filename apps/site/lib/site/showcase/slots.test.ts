import { describe, expect, it } from "vitest";
import type { ShowcaseAd } from "./records";
import { adSlotAfter, adSlotCounts } from "./slots";

const ad = (id: string) => ({ id }) as ShowcaseAd;

describe("слоты рекламы в каталоге (правки 15.11, п. 4 + 13)", () => {
  it("первый баннер — над списком; после каждой 6-й карточки — со второго по кругу; без баннеров — слотов нет", () => {
    const ads = [ad("a"), ad("b"), ad("c")];
    const slots = Array.from({ length: 24 }, (_, index) => adSlotAfter(index, ads)?.id ?? null);
    expect(slots.flatMap((id, index) => (id ? [[index, id]] : []))).toEqual([
      [5, "b"],
      [11, "c"],
      [17, "a"],
      [23, "b"],
    ]);
    // Показ засчитывает только первый круг: «a» — над списком, «b» и «c» — в слотах.
    expect([5, 11, 17].map((index) => adSlotCounts(index, ads))).toEqual([true, true, false]);
    expect(adSlotAfter(5, [])).toBeNull();
  });

  it("один баннер — над списком и он же после 6-й карточки, показ — один", () => {
    expect(adSlotAfter(5, [ad("a")])?.id).toBe("a");
    expect(adSlotCounts(5, [ad("a")])).toBe(false);
  });
});
