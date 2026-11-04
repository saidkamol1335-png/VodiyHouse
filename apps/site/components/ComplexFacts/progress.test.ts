import { describe, expect, it } from "vitest";
import { stepState } from "./progress";

describe("stepState", () => {
  it("до первого шага — все впереди", () => {
    expect([0, 1, 2].map((index) => stepState(index, -1))).toEqual(["ahead", "ahead", "ahead"]);
  });

  it("дошли до второго — первый пройден, второй текущий, третий впереди", () => {
    expect([0, 1, 2].map((index) => stepState(index, 1))).toEqual(["passed", "current", "ahead"]);
  });
});
