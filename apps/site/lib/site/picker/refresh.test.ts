import { describe, expect, it } from "vitest";
import { pickerRefreshMs } from "./refresh";

describe("частота обновления «Выбрать квартиру» (ответ заказчика 29.10)", () => {
  it("меньше 10 онлайн — раз в минуту, от 10 до 50 — раз в 30 с, больше 50 — раз в 15 с", () => {
    expect([0, 9, 10, 50, 51, 300].map(pickerRefreshMs)).toEqual([
      60_000, 60_000, 30_000, 30_000, 15_000, 15_000,
    ]);
  });

  it("онлайн неизвестен — средняя частота", () => {
    expect(pickerRefreshMs(null)).toBe(30_000);
  });
});
