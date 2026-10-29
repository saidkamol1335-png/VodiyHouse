import { describe, expect, it } from "vitest";
import { reportMonths } from "./types";

describe("месяц отчёта (фаза 5)", () => {
  it("текущий и прошлый — по Ташкенту, через границу года", () => {
    expect(reportMonths(new Date("2026-10-29T08:00:00Z"))).toEqual(["2026-10-01", "2026-09-01"]);
    // 31 декабря 20:30 UTC — в Ташкенте уже 1 января.
    expect(reportMonths(new Date("2026-12-31T20:30:00Z"))).toEqual(["2027-01-01", "2026-12-01"]);
    expect(reportMonths(new Date("2027-01-15T10:00:00Z"))).toEqual(["2027-01-01", "2026-12-01"]);
  });
});
