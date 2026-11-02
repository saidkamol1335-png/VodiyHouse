import { describe, expect, it } from "vitest";
import { layoutVariants } from "./layoutVariants";

describe("двойники планировок", () => {
  it("те же комнаты и площадь — варианты по id, в любом порядке одинаково; прочие — без номера", () => {
    const a = { id: "b-mirror", rooms: 2, area: 64.5 };
    const b = { id: "a-plain", rooms: 2, area: 64.5 };
    const other = { id: "c", rooms: 2, area: 71.3 };
    const expected = new Map([
      ["a-plain", 1],
      ["b-mirror", 2],
    ]);
    expect(layoutVariants([a, b, other])).toEqual(expected);
    expect(layoutVariants([other, b, a])).toEqual(expected);
    expect(layoutVariants([other])).toEqual(new Map());
  });
});
