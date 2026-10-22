import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UnitRecord } from "@/lib/units";
import { unitsFailure } from "./errors";
import { INITIAL_UNITS_LIST, unitsListReducer, type UnitsListEvent } from "./listState";
import type { UnitsEditActions } from "./types";
import { useUnitsBar } from "./useUnitsBar";
import { useUnitsEdit } from "./useUnitsEdit";
import type { UnitsListStore } from "./useUnitsList";

const unit = (number: string): UnitRecord => ({
  id: `u${number}`,
  entrance: 1,
  floor: 2,
  position: Number(number),
  number,
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status: "free",
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
});
const U1 = unit("1");
const U2 = unit("2");
const shown = () => true;
const closed = () => false;

/** Список в памяти: события — настоящим редьюсером, сохранение — сразу. */
function fakeStore() {
  let state = unitsListReducer(INITIAL_UNITS_LIST, { type: "readDone", units: [U1, U2] });
  const store: UnitsListStore = {
    get state() {
      return state;
    },
    units: [U1, U2],
    dispatch: (event: UnitsListEvent) => (state = unitsListReducer(state, event)),
    latest: () => state,
    reload: vi.fn(async () => true),
    track: (work) => work(),
  };
  return store;
}

function setup(actions: UnitsEditActions | null) {
  const store = fakeStore();
  const onListRemoved = vi.fn();
  const params = { blockId: "b", blockName: "A", viewerName: "Азиз", actions, onListRemoved };
  const hook = renderHook(() => {
    const bar = useUnitsBar();
    return { edit: useUnitsEdit(store, params, bar), bar: bar.bar };
  });
  const run = async <T>(work: () => Promise<T>) => {
    let result: T;
    await act(async () => {
      result = await work();
    });
    return result!;
  };
  return { store, hook, onListRemoved, run };
}

describe("правки руководителя", () => {
  it("менеджеру правок нет", () => {
    expect(setup(null).hook.result.current.edit).toBeNull();
  });

  it("строка: квартира из ответа (имя — того, кто правил), итог в полосе, без перечитывания", async () => {
    // Правка без изменений: база оставила прежнего автора — экран не подставляет своё имя.
    const update = vi.fn(async () => ({
      status: "done" as const,
      unit: { ...U2, number: "2А", updatedByName: "Дилноза" },
    }));
    const { store, hook, run } = setup({ update });
    const reply = await run(() => hook.result.current.edit!.saveRow(U2, { number: "2А" }, shown));
    expect(reply).toBeNull();
    expect(update).toHaveBeenCalledWith({ blockId: "b", unitId: "u2", patch: { number: "2А" } });
    expect(store.state.base![1]).toMatchObject({ number: "2А", updatedByName: "Дилноза" });
    expect(store.state.pinned).toEqual(new Set(["u2"]));
    expect(hook.result.current.bar).toMatchObject({
      busy: false,
      message: { kind: "rowSaved", number: "2А" },
    });
    expect(store.reload).not.toHaveBeenCalled();
  });

  it("отказ при открытой форме — форме, полоса пуста; номер заняли — перечитать", async () => {
    const add = vi.fn(async () => unitsFailure("unitNumberTaken"));
    const { store, hook, run } = setup({ add });
    const input = { entrance: 1, floor: 2, position: 3, number: "2", layoutId: null };
    const reply = await run(() => hook.result.current.edit!.addUnit(input, shown));
    expect(reply).toMatchObject({ error: "unitNumberTaken" });
    expect(hook.result.current.bar).toBeNull();
    expect(store.reload).toHaveBeenCalledOnce();
  });

  it("отказ, когда формы уже нет, — строкой в полосе; отказ по правилу — без перечитывания", async () => {
    const remove = vi.fn(async () => unitsFailure("notReady"));
    const { store, hook, run } = setup({ remove });
    await run(() => hook.result.current.edit!.removeUnits([U1, U2], closed));
    expect(hook.result.current.bar).toMatchObject({
      message: { kind: "editFailed", what: "remove", error: "notReady" },
    });
    expect(store.reload).not.toHaveBeenCalled();
  });

  it("«весь список» от базы — блок поменял кто-то ещё: список перечитывается", async () => {
    const remove = vi.fn(async () => unitsFailure("wholeList"));
    const { store, hook, run } = setup({ remove });
    await run(() => hook.result.current.edit!.removeUnits([U1], shown));
    expect(store.reload).toHaveBeenCalledOnce();
  });

  it("обрыв связи — «нет связи» форме и перечитывание (ответ мог потеряться после записи)", async () => {
    const finishing = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    const { store, hook, run } = setup({ finishing });
    const reply = await run(() => hook.result.current.edit!.setFinishing([U1], 3, shown));
    expect(reply).toMatchObject({ error: "network" });
    expect(store.reload).toHaveBeenCalledOnce();
  });

  it("«+ Квартира» закрыли до ответа — «Добавлена» в полосе; открытой — молча (пишет форма)", async () => {
    const added = { ...U2, id: "u9", number: "9", position: 9 };
    const add = vi.fn(async () => ({ status: "done" as const, unit: added }));
    const input = { entrance: 1, floor: 2, position: 9, number: "9", layoutId: null };
    const open = setup({ add });
    await open.run(() => open.hook.result.current.edit!.addUnit(input, shown));
    expect(open.hook.result.current.bar).toBeNull();
    const gone = setup({ add });
    await gone.run(() => gone.hook.result.current.edit!.addUnit(input, closed));
    expect(gone.hook.result.current.bar).toMatchObject({
      message: { kind: "added", number: "9" },
    });
    expect(gone.store.state.base!.map((item) => item.number)).toEqual(["1", "2", "9"]);
  });

  it("фильтр сменили, пока сохранялось, — строка не закрепляется под новым фильтром", async () => {
    let answer: (value: { status: "done"; unit: UnitRecord }) => void = () => {};
    const update = vi.fn(
      () => new Promise<{ status: "done"; unit: UnitRecord }>((resolve) => (answer = resolve)),
    );
    const { store, hook } = setup({ update });
    let saving: Promise<unknown> = Promise.resolve();
    act(() => {
      saving = hook.result.current.edit!.saveRow(U1, { number: "1Б" }, shown);
    });
    act(() => store.dispatch({ type: "filterChanged" }));
    await act(async () => {
      answer({ status: "done", unit: { ...U1, number: "1Б" } });
      await saving;
    });
    expect(store.state.base![0]!.number).toBe("1Б");
    expect(store.state.pinned.size).toBe(0);
  });

  it("правку закрыли вместе со строкой (квартиру удалили) — строкой в полосе; есть — молча", async () => {
    const { store, hook } = setup({});
    await act(async () => hook.result.current.edit!.draftLost(U1));
    expect(hook.result.current.bar).toBeNull();
    // Как в браузере: форма уходит раньше, чем список запомнит новое состояние, — проверка
    // должна дождаться конца отрисовки.
    await act(async () => {
      hook.result.current.edit!.draftLost(U1);
      store.dispatch({ type: "unitsRemoved", ids: new Set(["u1"]) });
    });
    expect(hook.result.current.bar).toMatchObject({
      busy: false,
      message: { kind: "rowGone", number: "1" },
    });
  });

  it("своё «Удалить» с открытой правкой — строки «удалили» нет", async () => {
    const remove = vi.fn(async () => ({ status: "done" as const, deleted: 1 }));
    const { store, hook, run } = setup({ remove });
    await run(() => hook.result.current.edit!.removeUnits([U1], shown));
    expect(store.state.base!.map((item) => item.id)).toEqual(["u2"]);
    expect(hook.result.current.bar).toMatchObject({ message: { kind: "deleted", count: 1 } });
    await act(async () => hook.result.current.edit!.draftLost(U1));
    expect(hook.result.current.bar).toMatchObject({ message: { kind: "deleted" }, lost: [] });
  });

  it("массовая отделка: поле в список, «поменялась у N»", async () => {
    const finishing = vi.fn(async () => ({ status: "done" as const, changed: 1 }));
    const { store, hook, run } = setup({ finishing });
    await run(() => hook.result.current.edit!.setFinishing([U1, U2], 3, shown));
    expect(finishing).toHaveBeenCalledWith({ blockId: "b", unitIds: ["u1", "u2"], finishingId: 3 });
    expect(store.state.base!.map((item) => item.finishingId)).toEqual([3, 3]);
    expect(hook.result.current.bar).toMatchObject({
      message: { kind: "finished", changed: 1 },
    });
  });

  it("массовая цена: поля в список, отметка, сколько поменялось и без планировки", async () => {
    const price = vi.fn(async () => ({ status: "done" as const, changed: 2, withoutLayout: 2 }));
    const { store, hook, run } = setup({ price });
    const change = { mode: "per_m2" as const, value: 620 };
    await run(() => hook.result.current.edit!.setPrice([U1, U2], change, shown));
    expect(price).toHaveBeenCalledWith({
      blockId: "b",
      unitIds: ["u1", "u2"],
      mode: "per_m2",
      value: 620,
    });
    expect(store.state.base!.map((item) => item.pricePerM2)).toEqual([620, 620]);
    expect(hook.result.current.bar).toMatchObject({
      message: { kind: "priced", changed: 2, withoutLayout: 2, none: false },
    });
  });

  it("«Удалить список блока»: уведомление над генератором, полосы нет", async () => {
    const removeList = vi.fn(async () => ({ status: "done" as const, deleted: 2 }));
    const { hook, onListRemoved, run } = setup({ removeList });
    expect(await run(() => hook.result.current.edit!.removeList("Блок A", shown))).toBeNull();
    expect(removeList).toHaveBeenCalledWith({ blockId: "b", confirm: "Блок A" });
    expect(onListRemoved).toHaveBeenCalledWith(2);
    expect(hook.result.current.bar).toBeNull();
  });

  it("«Удалить список блока» не удался после «Отмена» — строкой в полосе", async () => {
    const removeList = vi.fn(async () => unitsFailure("timeout"));
    const { hook, onListRemoved, run } = setup({ removeList });
    await run(() => hook.result.current.edit!.removeList("A", closed));
    expect(onListRemoved).not.toHaveBeenCalled();
    expect(hook.result.current.bar).toMatchObject({
      message: { kind: "editFailed", what: "removeList", error: "timeout" },
    });
  });

  it("действия нет у роли — отказ «нет прав» без запроса", async () => {
    const { hook, run } = setup({});
    const reply = await run(() => hook.result.current.edit!.setFinishing([U1], 3, shown));
    expect(reply).toMatchObject({ error: "forbidden" });
  });
});
