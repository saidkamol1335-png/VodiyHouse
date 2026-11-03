import { describe, expect, it } from "vitest";
import { hasStaffCookie } from "./staffCookie";

describe("метка браузера сотрудника", () => {
  it("находит vh-staff=1 в любом месте строки cookie, похожие имена и значения — нет", () => {
    expect(hasStaffCookie("vh-staff=1")).toBe(true);
    expect(hasStaffCookie("vh-vid=abc; vh-staff=1; vh-sid=x")).toBe(true);
    expect(hasStaffCookie("vh-staff=0")).toBe(false);
    expect(hasStaffCookie("vh-staff=10")).toBe(false);
    expect(hasStaffCookie("xvh-staff=1")).toBe(false);
    expect(hasStaffCookie("")).toBe(false);
  });
});
