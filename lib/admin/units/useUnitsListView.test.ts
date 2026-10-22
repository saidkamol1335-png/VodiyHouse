import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { UnitRecord } from "@/lib/units";
import { EditDirty } from "./editDirty";
import { pageWithPinned, useUnitsListView } from "./useUnitsListView";

const units = Array.from({ length: 5 }, (_, index) => ({ id: `u${index + 1}` }) as UnitRecord);
const ids = (list: readonly UnitRecord[]) => list.map((unit) => unit.id);

describe("порция списка и закреплённые строки", () => {
  it("закреплённая за порцией — после порции, не пропадает из-под руки", () => {
    expect(ids(pageWithPinned(units, 2, new Set()))).toEqual(["u1", "u2"]);
    expect(ids(pageWithPinned(units, 2, new Set(["u5", "u1"])))).toEqual(["u1", "u2", "u5"]);
    expect(pageWithPinned(units, 10, new Set(["u5"]))).toHaveLength(5);
  });
});

const record = (index: number, status: UnitRecord["status"] = "free"): UnitRecord => ({
  id: `u${index}`,
  entrance: 1,
  floor: 2,
  position: 1,
  number: String(index),
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status,
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
});

describe("раскрытая строка в списке", () => {
  it("держится и за порцией, и вне фильтра; «Выбрать все» берёт тот же набор", () => {
    const list = Array.from({ length: 300 }, (_, index) => record(index + 1));
    const params = {
      units: list,
      sticky: new Set<string>(),
      pinned: new Set<string>(),
      rooms: new Map<string, number>(),
      onFilterChange: () => {},
      dirty: new EditDirty(),
    };
    const hook = renderHook((props) => useUnitsListView(props), { initialProps: params });
    act(() => {
      hook.result.current.openRow("u250", "edit");
    });
    expect(ids(hook.result.current.shown)).toContain("u250");
    // Строку продали, пока она раскрыта, а фильтр — «свободна»: она остаётся на месте.
    act(() => hook.result.current.changeFilter({ ...hook.result.current.filter, status: "free" }));
    act(() => {
      hook.result.current.openRow("u250", "edit");
    });
    const sold = list.map((unit) =>
      unit.id === "u250" ? { ...unit, status: "sold" as const } : unit,
    );
    hook.rerender({ ...params, units: sold });
    expect(ids(hook.result.current.shown)).toContain("u250");
    expect(hook.result.current.visible).toHaveLength(300);
    expect(hook.result.current.matchingNow()).toHaveLength(300);
  });
});
