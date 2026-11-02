import { describe, expect, it } from "vitest";
import { UNIT_STATUSES, isUnitStatus } from "./status";

describe("статусы квартиры", () => {
  it("ровно три: свободна, бронь, продана", () => {
    expect(UNIT_STATUSES).toEqual(["free", "reserved", "sold"]);
  });

  it("распознаёт только свои значения", () => {
    expect(UNIT_STATUSES.every(isUnitStatus)).toBe(true);
    for (const value of ["booked", "FREE", "", null, 1]) expect(isUnitStatus(value)).toBe(false);
  });
});
