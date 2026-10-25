import { describe, expect, it } from "vitest";
import { archiveUnitsCsv } from "./csv";

// CSV квартир перед удалением ЖК из архива: шапка, статусы словами, защита от формул.

describe("archiveUnitsCsv", () => {
  it("шапка и строка; статус словом; номер с «=» — не формула", () => {
    const csv = archiveUnitsCsv([
      { complex: "Shodlik", block: "A", entrance: 1, floor: 3, number: "=12", rooms: 2, area: 64.5, price: 41000, price_per_m2: null, currency: "USD", status: "sold" },
    ]);
    const [head, row] = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(head).toContain("Квартира");
    expect(row).toBe("Shodlik;A;1;3;'=12;2;64.5;41000;;USD;продана");
  });
});
