import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTabSave } from "./useTabSave";

// «Сохранить вкладку» (вкладки ЖК): правка, сделанная, пока идёт сохранение, в него не попала —
// после «Сохранено» вкладка остаётся несохранённой («Уйти без сохранения?» сработает).

type Result = { status: "idle" } | { status: "saved"; at: number };

function Tab({ action }: { action: (formData: FormData) => Promise<Result> }) {
  const save = useTabSave(action, "Уйти без сохранения?");
  return (
    <form onSubmit={save.onSubmit} onInput={save.onInput}>
      <input aria-label="Текст" name="text" />
      <button type="submit">Сохранить</button>
      <output>{save.dirty ? "есть несохранённое" : "всё сохранено"}</output>
    </form>
  );
}

describe("useTabSave", () => {
  afterEach(cleanup);

  const deferred = () => {
    let resolve: (value: Result) => void = () => undefined;
    const promise = new Promise<Result>((done) => (resolve = done));
    return { promise, resolve };
  };

  it("без правок во время сохранения — после «Сохранено» несохранённого нет", async () => {
    const pending = deferred();
    render(<Tab action={() => pending.promise} />);
    fireEvent.input(screen.getByLabelText("Текст"), { target: { value: "а" } });
    fireEvent.click(screen.getByText("Сохранить"));
    await act(async () => pending.resolve({ status: "saved", at: 1 }));
    expect(screen.getByText("всё сохранено")).toBeTruthy();
  });

  it("правка во время сохранения — после «Сохранено» остаётся несохранённой", async () => {
    const pending = deferred();
    render(<Tab action={() => pending.promise} />);
    fireEvent.input(screen.getByLabelText("Текст"), { target: { value: "а" } });
    fireEvent.click(screen.getByText("Сохранить"));
    fireEvent.input(screen.getByLabelText("Текст"), { target: { value: "аб" } });
    await act(async () => pending.resolve({ status: "saved", at: 2 }));
    expect(screen.getByText("есть несохранённое")).toBeTruthy();
  });
});
