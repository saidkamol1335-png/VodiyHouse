import { describe, expect, it } from "vitest";
import { purgeMoment } from "./purge";

describe("напоминание архива", () => {
  it("день и время удаления — по Ташкенту: 19:30 UTC — это 00:30 следующего дня", () => {
    expect(purgeMoment("2026-11-28T19:30:00Z")).toBe("29.11.2026 в 00:30");
    expect(purgeMoment("2026-11-29T06:05:00Z")).toBe("29.11.2026 в 11:05");
  });
});
