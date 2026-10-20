import { describe, expect, it } from "vitest";
import { dropIndex, moveItem } from "./sortable";

describe("порядок перетаскиванием", () => {
  it("элемент переезжает, остальные сдвигаются; вне границ — без изменений", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
  });

  it("место — по чужим серединам выше пальца", () => {
    const middles = [10, 30, 50, 70];
    expect(dropIndex(middles, 0, 5)).toBe(0);
    expect(dropIndex(middles, 0, 35)).toBe(1);
    expect(dropIndex(middles, 0, 90)).toBe(3);
    expect(dropIndex(middles, 3, 20)).toBe(1);
  });
});
