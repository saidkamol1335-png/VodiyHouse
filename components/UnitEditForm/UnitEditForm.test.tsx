import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditDirty } from "@/lib/admin/units/editDirty";
import { UnitsEditContext, type UnitsEditContextValue } from "@/lib/admin/units/editContext";
import { unitsFailure } from "@/lib/admin/units/errors";
import type { UnitsEditControl } from "@/lib/admin/units/useUnitsEdit";
import type { UnitRecord } from "@/lib/units";
import ru from "@/messages/ru.json";
import { UnitEditForm } from "./UnitEditForm";

// Форма правки строки: отказ базы по полю — у поля, иначе общей строкой; «Сохранить» без правок
// закрывает форму без «Уйти без сохранения?».

const UNIT: UnitRecord = {
  id: "u41",
  entrance: 1,
  floor: 2,
  position: 1,
  number: "41",
  layoutId: "l1",
  price: null,
  pricePerM2: 620,
  finishingId: null,
  status: "free",
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
};

function renderForm(saveRow: UnitsEditControl["saveRow"], onDone = vi.fn()) {
  const edit = { saveRow, draftLost: vi.fn() } as unknown as UnitsEditControl;
  const context: UnitsEditContextValue = {
    edit,
    block: { id: "b", name: "A", floorsTotal: 9, finishingId: null, currency: "USD", unitCount: 1 },
    layouts: [
      { id: "l1", rooms: 1, area: 42.5, available: true, priceFrom: null },
      { id: "l2", rooms: 2, area: 58.7, available: true, priceFrom: null },
    ],
    finishings: [],
    units: [UNIT],
    dirty: new EditDirty(),
  };
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <UnitsEditContext.Provider value={context}>
        <UnitEditForm unit={UNIT} onDone={onDone} />
      </UnitsEditContext.Provider>
    </NextIntlClientProvider>,
  );
  return { onDone, context };
}

const save = () =>
  act(async () => fireEvent.click(screen.getByRole("button", { name: "Сохранить" })));

describe("правка квартиры", () => {
  afterEach(cleanup);

  it("планировки больше нет в блоке — ошибка у «Планировки», не молчание", async () => {
    const saveRow = vi.fn(async () => unitsFailure("invalid", "layout_id"));
    renderForm(saveRow);
    fireEvent.change(screen.getByLabelText("Планировка"), { target: { value: "l2" } });
    await save();
    expect(saveRow).toHaveBeenCalledOnce();
    expect(screen.getByText("Этой планировки больше нет в блоке — выберите другую")).toBeTruthy();
  });

  it("отказ без своего поля — общей строкой под формой", async () => {
    const saveRow = vi.fn(async () => unitsFailure("timeout"));
    renderForm(saveRow);
    fireEvent.change(screen.getByLabelText("Планировка"), { target: { value: "l2" } });
    await save();
    expect(screen.getByText(/База не успела ответить/)).toBeTruthy();
  });

  it("«Сохранить» без правок — форма закрывается без запроса и без вопроса", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const saveRow = vi.fn();
    const { onDone, context } = renderForm(saveRow);
    // Набрали и вернули как было — правок нет.
    const number = screen.getByLabelText("Номер");
    fireEvent.change(number, { target: { value: "42" } });
    fireEvent.change(number, { target: { value: "41" } });
    await save();
    expect(saveRow).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
    expect(context.dirty.confirmLeave()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

describe("правка квартиры: ответ после закрытия и отделка", () => {
  afterEach(cleanup);

  it("отделку скрыли в справочнике — ошибка у «Отделки»", async () => {
    const saveRow = vi.fn(async () => unitsFailure("invalid", "finishing_id"));
    renderForm(saveRow);
    fireEvent.change(screen.getByLabelText("Планировка"), { target: { value: "l2" } });
    await save();
    expect(screen.getByText("Эта отделка скрыта или удалена — выберите другую")).toBeTruthy();
  });

  it("форму закрыли, пока сохранялось, — успех не закрывает уже открытое другое", async () => {
    let answer: (reply: null) => void = () => {};
    const saveRow = vi.fn(() => new Promise<null>((resolve) => (answer = resolve)));
    const { onDone } = renderForm(saveRow);
    fireEvent.change(screen.getByLabelText("Планировка"), { target: { value: "l2" } });
    await save();
    cleanup();
    await act(async () => answer(null));
    expect(onDone).not.toHaveBeenCalled();
  });
});
