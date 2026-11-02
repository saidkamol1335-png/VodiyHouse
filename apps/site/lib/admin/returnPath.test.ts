import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./returnPath";

// Адрес возврата после входа: только свои пути кабинета.

describe("safeReturnPath", () => {
  it("путь кабинета с параметрами — да", () => {
    expect(safeReturnPath("/admin/zayavki/1045")).toBe("/admin/zayavki/1045");
    expect(safeReturnPath("/admin/zayavki?n=1045&status=new")).toBe("/admin/zayavki?n=1045&status=new");
  });

  it("чужой хост, «//», «\\», экран входа и не кабинет — нет", () => {
    for (const value of ["//evil.example", "/admin//evil.example", "/admin\\evil", "https://evil.example/admin", "/uz/admin", "/admin/vhod", "/administrator", "", null]) {
      expect(safeReturnPath(value)).toBeNull();
    }
  });
});
