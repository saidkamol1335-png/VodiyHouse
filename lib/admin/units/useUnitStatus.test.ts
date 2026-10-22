import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnitRecord, UnitStatus } from "@/lib/units";
import { unitsFailure } from "./errors";
import { INITIAL_UNITS_LIST, unitsListReducer, type UnitsListEvent } from "./listState";
import { UNITS_RELOAD_AFTER_MS } from "./statusOutcome";
import type { SetUnitsStatusResult, UnitsStatusActions } from "./types";
import { useUnitStatus } from "./useUnitStatus";
import { useUnitsBar } from "./useUnitsBar";
import { watchReturn, type UnitsListStore } from "./useUnitsList";

const unit = (number: string): UnitRecord => ({
  id: `u${number}`,
  entrance: 1,
  floor: 2,
  position: 1,
  number,
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status: "free",
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
});
const U41 = unit("41");
const U42 = unit("42");

/** Список в памяти: события — настоящим редьюсером, сохранение и чтение — сразу. */
function fakeStore(): UnitsListStore {
  let state = unitsListReducer(INITIAL_UNITS_LIST, { type: "readDone", units: [U41, U42] });
  const dispatch = (event: UnitsListEvent) => (state = unitsListReducer(state, event));
  return {
    get state() {
      return state;
    },
    units: [U41, U42],
    dispatch,
    latest: () => state,
    reload: vi.fn(async () => true),
    track: (work) => work(),
  };
}

/** set — ответы, которые тест отдаёт сам и в своём порядке. */
function controlledActions() {
  const answers: Array<(result: SetUnitsStatusResult) => void> = [];
  const actions: UnitsStatusActions = {
    set: () => new Promise((resolve) => answers.push(resolve)),
    revert: async () => ({ status: "done", reverted: 1, skipped: [], missing: 0 }),
  };
  return { actions, answers };
}

const done = (id: string, was: UnitStatus): SetUnitsStatusResult => ({
  status: "done",
  changed: 1,
  undo: [{ status: was, ids: [id] }],
});

function setup() {
  const store = fakeStore();
  const { actions, answers } = controlledActions();
  const params = { blockId: "b", blockName: "A", actions, viewerName: "Азиз" };
  const hook = renderHook(() => useUnitStatus(store, params, useUnitsBar()));
  const answer = async (index: number, result: SetUnitsStatusResult) =>
    act(async () => answers[index]!(result));
  return { hook, answer, store, actions };
}

describe("статус тапом: полоса", () => {
  it("ответ прежнего тапа не забирает полосу у следующего", async () => {
    const { hook, answer } = setup();
    act(() => hook.result.current.change([U41], "reserved"));
    act(() => hook.result.current.change([U42], "sold"));
    await answer(0, done("u41", "free"));
    expect(hook.result.current.bar).toMatchObject({ busy: true, message: { kind: "saving" } });
    await answer(1, done("u42", "free"));
    expect(hook.result.current.bar).toMatchObject({
      busy: false,
      message: { kind: "changed", subject: { number: "42" } },
      undo: { subject: { number: "42" } },
    });
  });

  it("отказ прежнего тапа не теряется: строкой в полосе следующего", async () => {
    const { hook, answer } = setup();
    act(() => hook.result.current.change([U41], "reserved"));
    act(() => hook.result.current.change([U42], "sold"));
    await answer(0, unitsFailure("timeout"));
    expect(hook.result.current.bar?.lost).toEqual([
      {
        message: { kind: "failed", subject: { number: "41", count: 1 }, error: "timeout" },
        blockId: "b",
        blockName: "A",
      },
    ]);
  });

  it("закрыли «×», пока сохранялось, а база отказала — отказ своей полосой", async () => {
    const { hook, answer } = setup();
    act(() => hook.result.current.change([U41], "reserved"));
    act(() => hook.result.current.dismiss());
    await answer(0, unitsFailure("notFound"));
    expect(hook.result.current.bar).toMatchObject({ message: { kind: "failed" }, undo: null });
  });
});

describe("массовая смена и «Отменить»", () => {
  it("скрытые фильтром выделенные не всплывают ни после смены, ни после «Отменить»", async () => {
    const { hook, answer, store } = setup();
    act(() => hook.result.current.change([U41, U42], "sold", new Set(["u41"])));
    expect([...store.state.sticky]).toEqual(["u41"]);
    await answer(0, {
      status: "done",
      changed: 2,
      undo: [{ status: "free", ids: ["u41", "u42"] }],
    });
    await act(async () => hook.result.current.undo());
    expect([...store.state.sticky]).toEqual(["u41"]);
  });

  it("Ctrl+Z работает и с фокусом на галочке строки; в поле ввода — нет", async () => {
    const { hook, answer, actions } = setup();
    const revert = vi.spyOn(actions, "revert");
    act(() => hook.result.current.change([U41], "reserved"));
    await answer(0, done("u41", "free"));
    const press = (target: HTMLElement) =>
      act(() => {
        target.dispatchEvent(
          new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
        );
      });
    const field = document.createElement("input");
    const check = document.createElement("input");
    check.type = "checkbox";
    document.body.append(field, check);
    press(field);
    expect(revert).not.toHaveBeenCalled();
    press(check);
    expect(revert).toHaveBeenCalledOnce();
    field.remove();
    check.remove();
  });

  it("«Отменить» тапа другого блока — ни кнопкой, ни Ctrl+Z; в своём блоке — да", async () => {
    const store = fakeStore();
    const { actions, answers } = controlledActions();
    const revert = vi.spyOn(actions, "revert");
    const hook = renderHook(
      ({ blockId }) =>
        useUnitStatus(
          store,
          { blockId, blockName: blockId, actions, viewerName: null },
          useUnitsBar(),
        ),
      { initialProps: { blockId: "a" } },
    );
    act(() => hook.result.current.change([U41], "reserved"));
    await act(async () => answers[0]!(done("u41", "free")));
    hook.rerender({ blockId: "b" });
    await act(async () => hook.result.current.undo());
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
      );
    });
    expect(revert).not.toHaveBeenCalled();
    hook.rerender({ blockId: "a" });
    await act(async () => hook.result.current.undo());
    expect(revert).toHaveBeenCalledOnce();
  });
});

describe("статус тапом: 5 с от ответа, а не от тапа", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ответ через 6 с — «Отменить» живёт ещё 5 с", async () => {
    const { hook, answer } = setup();
    act(() => hook.result.current.change([U41], "reserved"));
    act(() => vi.advanceTimersByTime(6000));
    expect(hook.result.current.bar?.busy).toBe(true);
    await answer(0, done("u41", "free"));
    act(() => vi.advanceTimersByTime(4900));
    expect(hook.result.current.bar?.undo).not.toBeNull();
    act(() => vi.advanceTimersByTime(100));
    expect(hook.result.current.bar).toBeNull();
  });

  it("наведение держит полосу; снятие паузы — остаток отсчёта", async () => {
    const { hook, answer } = setup();
    act(() => hook.result.current.change([U41], "reserved"));
    await answer(0, done("u41", "free"));
    act(() => hook.result.current.timer.pause("hover"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(hook.result.current.bar).not.toBeNull();
    act(() => hook.result.current.timer.resume("hover"));
    act(() => vi.advanceTimersByTime(5000));
    expect(hook.result.current.bar).toBeNull();
  });
});

describe("возврат на вкладку браузера", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setVisibility = (value: "hidden" | "visible") => {
    Object.defineProperty(document, "visibilityState", { value, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  it("скрыта меньше 10 с — не перечитывать; 10 с и больше — перечитать", () => {
    const onReturn = vi.fn();
    const stop = watchReturn(onReturn);
    setVisibility("hidden");
    vi.advanceTimersByTime(3000);
    setVisibility("visible");
    expect(onReturn).not.toHaveBeenCalled();
    setVisibility("hidden");
    vi.advanceTimersByTime(UNITS_RELOAD_AFTER_MS);
    setVisibility("visible");
    expect(onReturn).toHaveBeenCalledTimes(1);
    stop();
  });
});
