import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./returnPath";

// Адрес возврата после входа: только свои пути кабинета.

describe("safeReturnPath", () => {
  it("путь кабинета с параметрами — да", () => {
    expect(safeReturnPath("/zayavki/1045")).toBe("/zayavki/1045");
    expect(safeReturnPath("/zayavki?n=1045&status=new")).toBe("/zayavki?n=1045&status=new");
  });

  it("чужой хост, «//», «\\», экран входа и не кабинет — нет", () => {
    for (const value of ["//evil.example", "/zayavki//evil.example", "/zayavki\\evil", "https://evil.example/zayavki", "/vhod", "/dev/zhk", "/api/cron/leads", "", null]) {
      expect(safeReturnPath(value)).toBeNull();
    }
  });
});
