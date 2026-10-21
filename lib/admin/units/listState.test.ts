import { describe, expect, it } from "vitest";
import type { UnitRecord, UnitStatus } from "@/lib/units";
import {
  INITIAL_UNITS_LIST,
  confirmedStatuses,
  unitsListReducer,
  visibleUnits,
  type UnitsListEvent,
  type UnitsListState,
} from "./listState";

const unit = (number: string, status: UnitStatus): UnitRecord => ({
  id: `id-${number}`,
  entrance: 1,
  floor: 2,
  position: 1,
  number,
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status,
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
});
const STAMP = { at: "2026-10-21T10:00:00Z", by: "Азиз" };
const run = (state: UnitsListState, ...events: UnitsListEvent[]) =>
  events.reduce(unitsListReducer, state);
const loaded = (units: UnitRecord[]) => run(INITIAL_UNITS_LIST, { type: "readDone", units });
const statusOf = (state: UnitsListState, number: string) =>
  visibleUnits(state).find((item) => item.number === number)?.status;
const tap = (op: number, id: string, status: UnitStatus): UnitsListEvent => ({
  type: "statusSent",
  op,
  changes: new Map([[id, status]]),
});
const settle = (op: number, applied: Map<string, UnitStatus> | null): UnitsListEvent => ({
  type: "statusSettled",
  op,
  applied,
  stamp: STAMP,
});

describe("список квартир в браузере", () => {
  it("чтение: порядок номеров, ошибка не стирает прежний список", () => {
    const state = loaded([unit("10", "free"), unit("2", "sold"), unit("12А", "free")]);
    expect(visibleUnits(state).map((item) => item.number)).toEqual(["2", "10", "12А"]);
    const failed = run(state, { type: "readStarted" }, { type: "readFailed", error: "timeout" });
    expect(failed.base).toBe(state.base);
    expect(failed.readError).toBe("timeout");
    expect(run(failed, { type: "readStarted" }).readError).toBeNull();
  });

  it("тап: строка меняется сразу, подтверждение пишет статус и отметку", () => {
    const state = run(loaded([unit("41", "free")]), tap(1, "id-41", "reserved"));
    expect(statusOf(state, "41")).toBe("reserved");
    expect(state.base![0]!.status).toBe("free");
    const done = run(state, settle(1, new Map([["id-41", "reserved"]])));
    expect(done.pending.size).toBe(0);
    expect(done.base![0]).toMatchObject({ status: "reserved", updatedByName: "Азиз" });
  });

  it("отказ — откат к прочитанному", () => {
    const state = run(loaded([unit("41", "free")]), tap(1, "id-41", "sold"), settle(1, null));
    expect(statusOf(state, "41")).toBe("free");
  });

  it("два тапа одной квартиры: ответ первого не снимает правку второго", () => {
    const state = run(
      loaded([unit("41", "free")]),
      tap(1, "id-41", "reserved"),
      tap(2, "id-41", "sold"),
      settle(1, new Map([["id-41", "reserved"]])),
    );
    expect(statusOf(state, "41")).toBe("sold");
    expect(run(state, settle(2, null)).base![0]!.status).toBe("reserved");
  });

  it("чтение во время тапа не стирает правку; строки без правок — те же объекты", () => {
    const first = loaded([unit("1", "free"), unit("41", "free")]);
    const state = run(first, tap(1, "id-41", "sold"), {
      type: "readDone",
      units: [unit("1", "free"), unit("41", "free")],
    });
    expect(statusOf(state, "41")).toBe("sold");
    expect(state.base![0]).toBe(first.base![0]);
    expect(visibleUnits(state)[0]).toBe(first.base![0]);
  });

  it("сменённая строка помнится до смены фильтра; статусы для сверки — без слоя", () => {
    const state = run(loaded([unit("41", "free")]), tap(1, "id-41", "sold"));
    expect([...state.sticky]).toEqual(["id-41"]);
    expect(confirmedStatuses(state, ["id-41", "id-nope"])).toEqual(new Map([["id-41", "free"]]));
    expect(run(state, { type: "filterChanged" }).sticky.size).toBe(0);
  });
});
