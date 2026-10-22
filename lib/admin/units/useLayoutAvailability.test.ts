import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unitsFailure } from "./errors";
import type { ChangedResult, SetLayoutAvailableInput, UnitsLayout } from "./types";
import { useLayoutAvailability } from "./useLayoutAvailability";

const refresh = vi.fn();
const onStale = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const layout = (id: string, available = true): UnitsLayout => ({
  id,
  rooms: 1,
  area: 42.5,
  available,
  priceFrom: null,
});
const L1 = layout("l1");
const L2 = layout("l2", false);

/** Ответы отдаёт сам тест и в своём порядке. */
function controlled() {
  const answers: Array<(result: ChangedResult) => void> = [];
  const calls: SetLayoutAvailableInput[] = [];
  const action = (input: SetLayoutAvailableInput) => {
    calls.push(input);
    return new Promise<ChangedResult>((resolve) => answers.push(resolve));
  };
  return { action, answers, calls };
}

beforeEach(() => {
  refresh.mockClear();
  onStale.mockClear();
});

describe("«Доступна / нет в наличии» (Н7)", () => {
  it("тап сразу показывает новое значение, ответ базы его закрепляет", async () => {
    const { action, answers, calls } = controlled();
    const { result } = renderHook(() => useLayoutAvailability([L1, L2], action, onStale));
    act(() => void result.current.change(L1, false));
    expect(result.current.valueOf(L1)).toBe(false);
    expect(result.current.state.pending).toEqual({ l1: false });
    expect(calls).toEqual([{ layoutId: "l1", available: false }]);
    await act(async () => answers[0]!({ status: "done", changed: 1 }));
    expect(result.current.valueOf(L1)).toBe(false);
    expect(result.current.state.pending).toEqual({});
    expect(result.current.state.last).toEqual({ layoutId: "l1", available: false });
  });

  it("второй тап той же планировки, пока ответа нет, не отправляется", async () => {
    const { action, answers, calls } = controlled();
    const { result } = renderHook(() => useLayoutAvailability([L1], action, onStale));
    act(() => void result.current.change(L1, false));
    act(() => void result.current.change(L1, true));
    expect(calls).toHaveLength(1);
    await act(async () => answers[0]!({ status: "done", changed: 1 }));
    act(() => void result.current.change(L1, true));
    expect(calls).toHaveLength(2);
  });

  it("отказ — прежнее значение и текст у строки; устаревший экран перечитывается", async () => {
    const { action, answers } = controlled();
    const { result } = renderHook(() => useLayoutAvailability([L1, L2], action, onStale));
    act(() => void result.current.change(L2, true));
    await act(async () => answers[0]!(unitsFailure("timeout")));
    expect(result.current.valueOf(L2)).toBe(false);
    expect(result.current.state.errors).toEqual({ l2: "timeout" });
    expect(refresh).not.toHaveBeenCalled();
    expect(onStale).not.toHaveBeenCalled();
    // Блоку тем временем создали список: «доступна» теперь считается из квартир. Строки после
    // перечитывания не будет — ответ показывает вкладка (onStale), а не строка.
    act(() => void result.current.change(L2, true));
    expect(result.current.state.errors).toEqual({});
    await act(async () => answers[1]!(unitsFailure("listExists")));
    expect(onStale).toHaveBeenCalledWith("listExists");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.state.errors).toEqual({});
    expect(result.current.state.pending).toEqual({});
  });

  it("планировку удалили — тоже вкладкой и перечитыванием", async () => {
    const { action, answers } = controlled();
    const { result } = renderHook(() => useLayoutAvailability([L1], action, onStale));
    act(() => void result.current.change(L1, false));
    await act(async () => answers[0]!(unitsFailure("notFound")));
    expect(onStale).toHaveBeenCalledWith("notFound");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.valueOf(L1)).toBe(true);
  });

  it("отказ устарел: страница пришла с тем значением, что пытались сохранить, — текст снят", async () => {
    const { action, answers } = controlled();
    const { result, rerender } = renderHook(
      ({ layouts }) => useLayoutAvailability(layouts, action, onStale),
      { initialProps: { layouts: [L1, L2] } },
    );
    act(() => void result.current.change(L1, false));
    act(() => void result.current.change(L2, true));
    await act(async () => answers[0]!(unitsFailure("timeout")));
    await act(async () => answers[1]!(unitsFailure("timeout")));
    expect(result.current.state.errors).toEqual({ l1: "timeout", l2: "timeout" });
    // Другой сотрудник поставил первой «нет в наличии»; вторая не менялась — её отказ остаётся.
    rerender({ layouts: [layout("l1", false), L2] });
    expect(result.current.state.errors).toEqual({ l2: "timeout" });
  });

  it("обрыв связи — «нет связи», а не исключение", async () => {
    const action = () => Promise.reject(new Error("offline"));
    const { result } = renderHook(() => useLayoutAvailability([L1], action, onStale));
    await act(async () => result.current.change(L1, false));
    expect(result.current.state.errors).toEqual({ l1: "network" });
    expect(result.current.valueOf(L1)).toBe(true);
  });

  it("две планировки сразу: отказ одной не трогает другую", async () => {
    const { action, answers } = controlled();
    const { result } = renderHook(() => useLayoutAvailability([L1, L2], action, onStale));
    act(() => void result.current.change(L1, false));
    act(() => void result.current.change(L2, true));
    expect(result.current.state.pending).toEqual({ l1: false, l2: true });
    await act(async () => answers[1]!(unitsFailure("timeout")));
    await act(async () => answers[0]!({ status: "done", changed: 1 }));
    expect(result.current.valueOf(L1)).toBe(false);
    expect(result.current.valueOf(L2)).toBe(false);
    expect(result.current.state.errors).toEqual({ l2: "timeout" });
    expect(result.current.state.pending).toEqual({});
  });

  it("страница перерисовалась, пока ответа нет: на экране — то, что сохраняется", async () => {
    const { action, answers } = controlled();
    const { result, rerender } = renderHook(
      ({ layouts }) => useLayoutAvailability(layouts, action, onStale),
      { initialProps: { layouts: [L1, L2] } },
    );
    act(() => void result.current.change(L1, false));
    // Чужая правка второй планировки перерисовала страницу (updateTag) — первая ещё в пути.
    const fresh = [L1, layout("l2", true)];
    rerender({ layouts: fresh });
    expect(result.current.valueOf(L1)).toBe(false);
    expect(result.current.valueOf(fresh[1]!)).toBe(true);
    await act(async () => answers[0]!({ status: "done", changed: 1 }));
    expect(result.current.valueOf(L1)).toBe(false);
  });

  it("новые планировки со страницы (после updateTag) заменяют подтверждённое", async () => {
    const action = async (): Promise<ChangedResult> => ({ status: "done", changed: 1 });
    const { result, rerender } = renderHook(
      ({ layouts }) => useLayoutAvailability(layouts, action, onStale),
      { initialProps: { layouts: [L1] } },
    );
    await act(async () => result.current.change(L1, false));
    expect(result.current.valueOf(L1)).toBe(false);
    // Новый массив с теми же данными — не повод сбрасывать (и не бесконечная перерисовка).
    rerender({ layouts: [layout("l1")] });
    expect(result.current.valueOf(L1)).toBe(false);
    // Страница перерисовалась с базой: сначала наше «нет», потом «доступна» другого сотрудника.
    rerender({ layouts: [layout("l1", false)] });
    const fresh = layout("l1", true);
    rerender({ layouts: [fresh] });
    expect(result.current.valueOf(fresh)).toBe(true);
  });
});
