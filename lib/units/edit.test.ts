import { describe, expect, it } from "vitest";
import { UNIT_FIELDS, reuseUnchanged, withStatuses } from "./edit";
import type { UnitRecord } from "./record";

const unit = (id: string, status: UnitRecord["status"]): UnitRecord => ({
  id,
  entrance: 1,
  floor: 2,
  position: 1,
  number: id,
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status,
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
});
const STAMP = { at: "2026-10-21T10:00:00Z", by: "Азиз" };

describe("правки прочитанного списка", () => {
  it("смена статуса: отметка «кто и когда», остальные строки — те же объекты", () => {
    const units = [unit("1", "free"), unit("2", "free"), unit("3", "sold")];
    const next = withStatuses(
      units,
      new Map([
        ["2", "reserved"],
        ["3", "sold"],
      ]),
      STAMP,
    );
    expect(next[1]).toMatchObject({
      status: "reserved",
      updatedAt: STAMP.at,
      updatedByName: "Азиз",
    });
    expect(next[0]).toBe(units[0]);
    // Тот же статус — не правка: отметка не ставится.
    expect(next[2]).toBe(units[2]);
  });

  it("новое чтение: неизменённые квартиры — прежние объекты, изменённые и новые — из чтения", () => {
    const previous = [unit("1", "free"), unit("2", "free")];
    const fresh = [
      unit("1", "free"),
      { ...unit("2", "sold"), updatedByName: "Нигора" },
      unit("4", "free"),
    ];
    const merged = reuseUnchanged(previous, fresh);
    expect(merged[0]).toBe(previous[0]);
    expect(merged[1]).toBe(fresh[1]);
    expect(merged[2]).toBe(fresh[2]);
    expect(reuseUnchanged(null, fresh)).toEqual(fresh);
  });

  const CHANGED: { [Field in (typeof UNIT_FIELDS)[number]]: UnitRecord[Field] } = {
    entrance: 2,
    floor: 9,
    position: 3,
    number: "41А",
    layoutId: "l2",
    price: 40_000,
    pricePerM2: 600,
    finishingId: 4,
    status: "sold",
    updatedAt: "2026-10-21T11:00:00Z",
    updatedByName: "Нигора",
  };

  it.each(UNIT_FIELDS)("поменялось одно поле (%s) — объект из чтения", (field) => {
    const previous = [unit("1", "free")];
    const fresh = [{ ...unit("1", "free"), [field]: CHANGED[field] }];
    expect(reuseUnchanged(previous, fresh)[0]).toBe(fresh[0]);
  });
});
