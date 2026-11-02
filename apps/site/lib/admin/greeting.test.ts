import { describe, expect, it } from "vitest";
import { greetingOf } from "./greeting";

// Перенесено из lib/format.test.ts при выносе format в @vh/shared (PLAN §10): приветствие — кабинет.
const tashkent = (hour: number) => new Date(Date.UTC(2026, 9, 19, hour - 5, 30));

describe("приветствие по времени суток", () => {
  it.each([
    [5, "morning"],
    [11, "morning"],
    [12, "day"],
    [17, "day"],
    [18, "evening"],
    [23, "evening"],
    [2, "evening"],
  ] as const)("%i:30 — %s", (hour, key) => {
    expect(greetingOf(tashkent(hour))).toBe(key);
  });
});
