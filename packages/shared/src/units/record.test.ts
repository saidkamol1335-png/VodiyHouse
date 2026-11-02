import { describe, expect, it } from "vitest";
import { parseUnitRecord, parseUnitRecords } from "./record";
import { parseUnitsUndo } from "./status";

const ROW = {
  id: "8f0e9a5e-6c2b-4b5e-9a51-0d1d6f1f2a3b",
  entrance: 1,
  floor: 2,
  position: 3,
  number: "12А",
  layout_id: null,
  price: 37200.0,
  price_per_m2: null,
  finishing_id: 2,
  status: "reserved",
  updated_at: "2026-10-21T10:00:00+05:00",
  updated_by_name: "Дилноза Юсупова",
};

describe("квартира из базы", () => {
  it("строка block_unit_rows → запись кабинета", () => {
    expect(parseUnitRecords([ROW])).toEqual([
      {
        id: ROW.id,
        entrance: 1,
        floor: 2,
        position: 3,
        number: "12А",
        layoutId: null,
        price: 37200,
        pricePerM2: null,
        finishingId: 2,
        status: "reserved",
        updatedAt: ROW.updated_at,
        updatedByName: "Дилноза Юсупова",
      },
    ]);
  });

  it("строка таблицы из add_unit / update_unit — без имени автора; цена строкой — числом", () => {
    const row = Object.fromEntries(
      Object.entries(ROW).filter(([key]) => key !== "updated_by_name"),
    );
    expect(
      parseUnitRecord({ ...row, price: "41000.00", block_id: "x", updated_by: "y" }),
    ).toMatchObject({
      price: 41000,
      updatedByName: null,
    });
  });

  it("время правки, которое не разобрать, — исключение (иначе «обновлено …» уронило бы список)", () => {
    expect(() => parseUnitRecord({ ...ROW, updated_at: "вчера" })).toThrow();
  });

  it("чужая форма — исключение, а не пустой список", () => {
    expect(() => parseUnitRecords({})).toThrow();
    expect(() => parseUnitRecord({ ...ROW, status: "booked" })).toThrow();
    expect(() => parseUnitRecord({ ...ROW, floor: "второй" })).toThrow();
  });

  it("undo «Отменить»: группы статусов с uuid; другое — null", () => {
    const undo = [{ status: "free", ids: [ROW.id] }];
    expect(parseUnitsUndo(undo)).toEqual(undo);
    expect(parseUnitsUndo([])).toEqual([]);
    expect(parseUnitsUndo([{ status: "free", ids: ["1"] }])).toBeNull();
    expect(parseUnitsUndo([{ status: "gone", ids: [] }])).toBeNull();
    expect(parseUnitsUndo({})).toBeNull();
  });
});
