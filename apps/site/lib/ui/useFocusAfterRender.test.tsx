import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFocusAfterRender, useFocusFirstInvalid } from "./useFocusAfterRender";

// Отказ до запроса ставит ошибку в коммите самого события — раньше, чем .then попросит фокус:
// запрос обязан перерисовать форму сам (третий круг 12.7). Не найденная цель фокус потом не берёт.

let clock = 0;

/** late — коммит запроса позже срока (вкладку спрятали в Activity, эффекты ждут показа). */
function InvalidForm({ fails, late = false }: { fails: boolean; late?: boolean }) {
  const [invalid, setInvalid] = useState(false);
  const focusInvalid = useFocusFirstInvalid();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (fails) setInvalid(true);
        void Promise.resolve().then(() => {
          focusInvalid(form);
          if (late) clock += 5000;
        });
      }}
    >
      <input aria-label="Номер" aria-invalid={invalid || undefined} />
      <button type="button" onClick={() => setInvalid(true)}>
        Сломать
      </button>
      <button type="submit">Сохранить</button>
    </form>
  );
}

const press = (name: string) =>
  act(async () => {
    const button = screen.getByRole("button", { name });
    button.focus();
    fireEvent.click(button);
  });

function RemovableRows() {
  const [rows, setRows] = useState(["a", "b"]);
  const focus = useFocusAfterRender();
  return (
    <ul id="rows" tabIndex={-1}>
      {rows.map((row) => (
        <li key={row}>
          <button
            type="button"
            onClick={() => {
              setRows(rows.filter((item) => item !== row));
              focus(`missing-${row}`, "rows");
            }}
          >
            {`Убрать ${row}`}
          </button>
        </li>
      ))}
    </ul>
  );
}

describe("фокус после перерисовки", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("отказ до запроса — фокус на неверное поле, хотя ошибку отрисовал коммит события", async () => {
    render(<InvalidForm fails />);
    await press("Сохранить");
    expect(document.activeElement).toBe(screen.getByLabelText("Номер"));
  });

  it("успех без ошибок — запрос гаснет: поздняя ошибка фокус не перехватывает", async () => {
    render(<InvalidForm fails={false} />);
    await press("Сохранить");
    await press("Сломать");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Сломать" }));
  });

  it("коммит запроса позже срока — фокус не прыгает (возврат на спрятанную вкладку)", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    render(<InvalidForm fails late />);
    await press("Сохранить");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Сохранить" }));
  });

  it("первый существующий из id: кнопка ушла вместе со строкой — фокус на список", async () => {
    render(<RemovableRows />);
    await press("Убрать a");
    expect(document.activeElement?.id).toBe("rows");
  });
});
