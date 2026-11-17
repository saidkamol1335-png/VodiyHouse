import { describe, expect, it } from "vitest";
import type { ShowcaseAd } from "./records";
import { adSlotAfter } from "./slots";

const ad = (id: string) => ({ id }) as ShowcaseAd;

describe("слоты рекламы в каталоге (правки 15.11, п. 4 + 13)", () => {
  it("после каждой 6-й карточки, баннеры по кругу; без баннеров — слотов нет", () => {
    const ads = [ad("a"), ad("b")];
    const slots = Array.from({ length: 24 }, (_, index) => adSlotAfter(index, ads)?.id ?? null);
    expect(slots.flatMap((id, index) => (id ? [[index, id]] : []))).toEqual([
      [5, "a"],
      [11, "b"],
      [17, "a"],
      [23, "b"],
    ]);
    expect(adSlotAfter(5, [])).toBeNull();
  });
});
