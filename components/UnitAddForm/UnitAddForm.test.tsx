import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unitsFailure } from "@/lib/admin/units/errors";
import type { UnitsEditControl } from "@/lib/admin/units/useUnitsEdit";
import type { UnitRecord } from "@/lib/units";
import ru from "@/messages/ru.json";
import { UnitAddForm } from "./UnitAddForm";

// «+ Квартира»: отказ базы по месту и планировке — у своих полей; после «Добавить» — следующий
// номер и свободная позиция этажа, фокус — снова на «Добавить».

const unit = (number: string, position: number): UnitRecord => ({
  id: `u${number}`,
  entrance: 1,
  floor: 2,
  position,
  number,
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status: "free",
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
});
const UNITS = [unit("1", 1), unit("2", 2), unit("3", 3)];
const LAYOUTS = [{ id: "l1", rooms: 1, area: 42.5, available: true, priceFrom: null }];

function renderForm(addUnit: UnitsEditControl["addUnit"], units = UNITS) {
  const edit = { addUnit } as unknown as UnitsEditControl;
  const view = (list: readonly UnitRecord[]) => (
    <NextIntlClientProvider locale="ru" messages={ru}>
      <UnitAddForm
        units={list}
        layouts={LAYOUTS}
        floorsTotal={9}
        risers={[]}
        edit={edit}
        onClose={() => {}}
      />
    </NextIntlClientProvider>
  );
  const result = render(view(units));
  return { rerender: (list: readonly UnitRecord[]) => result.rerender(view(list)) };
}

const add = () =>
  act(async () => fireEvent.click(screen.getByRole("button", { name: "Добавить" })));

describe("«+ Квартира»", () => {
  afterEach(cleanup);

  it("места больше нет в блоке (этажность уменьшили) — ошибка у места, не общей строкой", async () => {
    renderForm(vi.fn(async () => unitsFailure("invalid", "slot")));
    fireEvent.change(screen.getByLabelText("Этаж"), { target: { value: "5" } });
    await add();
    expect(screen.getByText(/Такого места в блоке нет/)).toBeTruthy();
    expect(screen.queryByText(/Проверьте поля/)).toBeNull();
  });

  it("место занято (без запроса) — фокус на первое поле места, диктор слышит причину", async () => {
    const addUnit = vi.fn(async () => null);
    renderForm(addUnit);
    fireEvent.change(screen.getByLabelText("Этаж"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Позиция"), { target: { value: "1" } });
    await add();
    expect(addUnit).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Место занято/).length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(screen.getByLabelText("Подъезд"));
  });

  it("планировку убрали из блока — ошибка у «Планировки»", async () => {
    renderForm(vi.fn(async () => unitsFailure("invalid", "layout_id")));
    fireEvent.change(screen.getByLabelText("Этаж"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Планировка"), { target: { value: "l1" } });
    await add();
    expect(screen.getByText("Этой планировки больше нет в блоке — выберите другую")).toBeTruthy();
  });

  it("после «Добавить» — следующий номер и свободная позиция этажа", async () => {
    // Успех для формы — null (квартиру в список кладёт уже useUnitsEdit).
    const addUnit = vi.fn(async () => null);
    // Этаж 5 свободен: позиция 1 занята новой — следующая свободная 2.
    renderForm(addUnit);
    fireEvent.change(screen.getByLabelText("Этаж"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Позиция"), { target: { value: "1" } });
    await add();
    expect(addUnit).toHaveBeenCalledWith(
      { entrance: 1, floor: 5, position: 1, number: "4", layoutId: null },
      expect.any(Function),
    );
    expect(screen.getByText(/Добавлена кв. 4/)).toBeTruthy();
    expect((screen.getByLabelText("Номер") as HTMLInputElement).value).toBe("5");
    expect((screen.getByLabelText("Позиция") as HTMLInputElement).value).toBe("2");
  });
});
