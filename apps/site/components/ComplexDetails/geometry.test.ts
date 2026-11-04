import { describe, expect, it } from "vitest";
import { flipFrom, lensPlacement } from "./geometry";

const root = { left: 100, top: 1000, width: 1200, height: 400 };

describe("lensPlacement", () => {
  it("по центру над карточкой, в 1,5 раза шире, выше на 16 px; FLIP — из карточки", () => {
    const place = lensPlacement({ left: 500, top: 1040, width: 300, height: 360 }, root);
    expect(place.width).toBe(450);
    expect(place.x).toBe(325);
    expect(place.y).toBe(24);
    expect(place.dx).toBe(75);
    expect(place.dy).toBe(16);
    expect(place.scale).toBeCloseTo(300 / 450, 6);
  });

  it("не шире 560 px и не выходит за края блока", () => {
    const left = lensPlacement({ left: 100, top: 1000, width: 420, height: 300 }, root);
    expect(left.width).toBe(560);
    expect(left.x).toBe(0);
    const right = lensPlacement({ left: 980, top: 1000, width: 420, height: 300 }, root);
    expect(right.x).toBe(root.width - 560);
  });
});

describe("flipFrom", () => {
  it("сдвиг и масштаб от угла окна к карточке", () => {
    expect(flipFrom({ left: 10, top: 20, width: 100, height: 50 }, { left: 0, top: 0, width: 200, height: 100 })).toBe(
      "translate(10.0px, 20.0px) scale(0.500, 0.500)",
    );
  });
});
