import { describe, expect, it } from "vitest";
import { adGoesFirst, overlappingAds, periodsOverlap, showcaseStatus, todayInTashkent } from "./period";

const ad = (id: string, validFrom: string, validTo: string, sort = 0, isActive = true) => ({
  id,
  validFrom,
  validTo,
  sort,
  isActive,
  createdAt: `2026-10-0${id}T00:00:00Z`,
});

describe("период показа витрины", () => {
  it("сегодня — по Ташкенту: в 22:00 UTC там уже следующий день", () => {
    expect(todayInTashkent(new Date("2026-10-28T22:00:00Z"))).toBe("2026-10-29");
    expect(todayInTashkent(new Date("2026-10-28T12:00:00Z"))).toBe("2026-10-28");
  });

  it("статус: выключено · ждёт · на сайте · истекло; подборка без периода — по флагу", () => {
    const period = { validFrom: "2026-11-01", validTo: "2026-11-10" };
    expect(showcaseStatus({ isActive: false, ...period }, "2026-11-05")).toBe("off");
    expect(showcaseStatus({ isActive: true, ...period }, "2026-10-31")).toBe("scheduled");
    expect(showcaseStatus({ isActive: true, ...period }, "2026-11-01")).toBe("active");
    expect(showcaseStatus({ isActive: true, ...period }, "2026-11-10")).toBe("active");
    expect(showcaseStatus({ isActive: true, ...period }, "2026-11-11")).toBe("expired");
    expect(showcaseStatus({ isActive: true, validFrom: null, validTo: null }, "2026-11-11")).toBe("active");
  });

  it("пересечение периодов — включая общий день", () => {
    expect(periodsOverlap({ validFrom: "2026-11-01", validTo: "2026-11-10" }, { validFrom: "2026-11-10", validTo: "2026-11-20" })).toBe(true);
    expect(periodsOverlap({ validFrom: "2026-11-01", validTo: "2026-11-09" }, { validFrom: "2026-11-10", validTo: "2026-11-20" })).toBe(false);
  });

  it("очередь рекламы (Г1 A): пересекающиеся включённые — по порядку, выключенные не считаются", () => {
    const first = ad("1", "2026-11-01", "2026-11-15", 10);
    const second = ad("2", "2026-11-10", "2026-11-30", 20);
    const off = ad("3", "2026-11-01", "2026-11-30", 5, false);
    const later = ad("4", "2026-12-01", "2026-12-10", 1);
    const ads = [second, off, later, first];
    expect(overlappingAds(first, ads).map((item) => item.id)).toEqual(["2"]);
    expect(overlappingAds(second, ads).map((item) => item.id)).toEqual(["1"]);
    expect(adGoesFirst(first, ads)).toBe(true);
    expect(adGoesFirst(second, ads)).toBe(false);
    expect(adGoesFirst(later, ads)).toBe(true);
    expect(adGoesFirst(off, ads)).toBe(true);
  });
});
