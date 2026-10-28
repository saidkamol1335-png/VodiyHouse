import { describe, expect, it } from "vitest";
import { parseContour, parseFloorRange, parseUnitContours, percentPoint } from "./contours";

const RECT = [
  [10, 10],
  [40, 10],
  [40, 60],
];

describe("контуры фасада и планов", () => {
  it("точка щелчка — проценты картинки до сотых, в пределах 0–100", () => {
    expect(percentPoint(50, 25, 200, 100)).toEqual([25, 25]);
    expect(percentPoint(-5, 130, 200, 100)).toEqual([0, 100]);
    expect(percentPoint(1, 1, 3, 3)).toEqual([33.33, 33.33]);
  });

  it("контур — 3–40 точек в 0–100, как в базе", () => {
    expect(parseContour(RECT)).toEqual(RECT);
    expect(parseContour(RECT.slice(0, 2))).toBeNull();
    expect(parseContour([...RECT, [101, 5]])).toBeNull();
    expect(parseContour([...RECT, ["1", 5]])).toBeNull();
    expect(parseContour(Array.from({ length: 41 }, () => [1, 1]))).toBeNull();
  });

  it("контуры квартир: подъезд плана, место один раз", () => {
    const contours = [
      { entrance: 1, position: 1, points: RECT },
      { entrance: 1, position: 2, points: RECT },
    ];
    expect(parseUnitContours(contours, 1)).toHaveLength(2);
    expect(parseUnitContours(contours, null)).toHaveLength(2);
    expect(parseUnitContours(contours, 2)).toBeNull();
    expect(parseUnitContours([contours[0], contours[0]], 1)).toBeNull();
    expect(parseUnitContours([{ entrance: 1, position: 0, points: RECT }], 1)).toBeNull();
    expect(parseUnitContours("[]", 1)).toBeNull();
  });

  it("этажи плана: целые, «с» не выше «по», в пределах этажности", () => {
    expect(parseFloorRange("2", "9", 12)).toEqual({ from: 2, to: 9 });
    expect(parseFloorRange(9, 2, 12)).toBeNull();
    expect(parseFloorRange(2, 13, 12)).toBeNull();
    expect(parseFloorRange(2, 13, null)).toEqual({ from: 2, to: 13 });
    expect(parseFloorRange(0, 3, null)).toBeNull();
  });
});
