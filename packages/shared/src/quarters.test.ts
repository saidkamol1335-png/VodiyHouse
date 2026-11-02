import { describe, expect, it } from "vitest";
import { QUARTERS, deliveryStatus, quarterEndDate, quarterOf } from "./quarters";

describe("кварталы", () => {
  it("дата → квартал: границы кварталов", () => {
    expect(quarterOf("2023-01-01")).toEqual({ quarter: 1, year: 2023 });
    expect(quarterOf("2023-03-31")).toEqual({ quarter: 1, year: 2023 });
    expect(quarterOf("2023-04-01")).toEqual({ quarter: 2, year: 2023 });
    expect(quarterOf("2022-12-31")).toEqual({ quarter: 4, year: 2022 });
  });

  it("не дата ISO — null", () => {
    for (const value of ["", "31.03.2023", "2023-13-01", "2023-3-31"]) {
      expect(quarterOf(value)).toBeNull();
    }
  });

  it("квартал → последний день, в том числе 29 февраля не бывает в конце квартала", () => {
    expect(QUARTERS.map((quarter) => quarterEndDate({ quarter, year: 2024 }))).toEqual([
      "2024-03-31",
      "2024-06-30",
      "2024-09-30",
      "2024-12-31",
    ]);
  });

  it("туда и обратно — тот же квартал", () => {
    for (const quarter of QUARTERS) {
      expect(quarterOf(quarterEndDate({ quarter, year: 2027 }))).toEqual({ quarter, year: 2027 });
    }
  });
});

describe("плашка сданного объекта (мокап)", () => {
  it("2 кв. 2021 → 2 кв. 2021: сдан в срок", () => {
    expect(deliveryStatus("2021-06-30", "2021-06-30")).toEqual({ kind: "onTime" });
  });

  it("4 кв. 2022 → 1 кв. 2023: перенос на 3 мес.; 3 кв. 2025 → 1 кв. 2026: на 6 мес.", () => {
    expect(deliveryStatus("2022-12-31", "2023-03-31")).toEqual({ kind: "delayed", months: 3 });
    expect(deliveryStatus("2025-09-30", "2026-03-31")).toEqual({ kind: "delayed", months: 6 });
  });

  it("раньше плана — тоже в срок; без плана или факта — без плашки", () => {
    expect(deliveryStatus("2024-12-31", "2024-06-30")).toEqual({ kind: "onTime" });
    expect(deliveryStatus(null, "2024-06-30")).toBeNull();
    expect(deliveryStatus("2024-12-31", null)).toBeNull();
  });
});
