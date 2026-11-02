import path from "node:path";
import { describe, expect, it } from "vitest";
import { reachableModules, routeFiles, SHARED_SRC } from "@/tests/unit/importGraph";

// Скидки — только в кабинете (PLAN §3.13, §3б); формулы скидок живут в @vh/shared/calc/cabinet.
describe("скидки кабинета", () => {
  it("сайт не импортирует скидки: из маршрутов app/[locale] модуль недостижим", () => {
    const cabinetDir = path.join(SHARED_SRC, "calc", "cabinet");
    const reached = reachableModules(routeFiles("app/[locale]"));
    expect(reached.length).toBeGreaterThan(0);
    expect(reached.some((file) => file.startsWith(path.join(SHARED_SRC, "calc")))).toBe(true);
    expect(reached.filter((file) => file.startsWith(cabinetDir))).toEqual([]);
  });
});
