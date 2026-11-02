import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDraftRows } from "./useDraftRows";

type Row = { key: string; name: string; id: string | null };

const server = (...names: string[]): Row[] =>
  names.map((name) => ({ key: `k-${name}`, name, id: `id-${name}` }));

type Props = { rows: Row[]; dirty: boolean; savedAt: number | null };

function setup(initial: Props) {
  return renderHook(
    ({ rows, dirty, savedAt }: Props) => useDraftRows(rows, { dirty, savedAt, markDirty: () => {} }),
    { initialProps: initial },
  );
}

describe("черновик списка вкладки", () => {
  it("refresh от шапки (новый список с сервера) не стирает несохранённое", () => {
    const hook = setup({ rows: server("A"), dirty: false, savedAt: null });
    act(() => hook.result.current.change((rows) => [...rows, { key: "new", name: "B", id: null }]));
    hook.rerender({ rows: server("A"), dirty: true, savedAt: null });
    expect(hook.result.current.rows.map((row) => row.name)).toEqual(["A", "B"]);
  });

  it("своё «Сохранено» берёт список с сервера (строки с id), даже пока флаг правок не снят", () => {
    const hook = setup({ rows: server("A"), dirty: true, savedAt: null });
    act(() => hook.result.current.change((rows) => [...rows, { key: "new", name: "B", id: null }]));
    hook.rerender({ rows: server("A", "B"), dirty: true, savedAt: 1 });
    expect(hook.result.current.rows.map((row) => row.id)).toEqual(["id-A", "id-B"]);
    // Ошибка после сохранения (savedAt снова null) — не «своё сохранение»: черновик цел.
    act(() => hook.result.current.update("k-A", { name: "A2" }));
    hook.rerender({ rows: server("A", "B"), dirty: true, savedAt: null });
    expect(hook.result.current.rows[0]?.name).toBe("A2");
  });

  it("правка после ожидания ложится на актуальные строки, а не на снимок", () => {
    const hook = setup({ rows: server("A", "B"), dirty: false, savedAt: null });
    const lateUpdate = hook.result.current.update;
    act(() => hook.result.current.update("k-B", { name: "B2" }));
    act(() => hook.result.current.remove("k-A"));
    act(() => lateUpdate("k-B", { id: "drawing" }));
    act(() => lateUpdate("k-A", { name: "вернулась?" }));
    expect(hook.result.current.rows).toEqual([{ key: "k-B", name: "B2", id: "drawing" }]);
  });
});
