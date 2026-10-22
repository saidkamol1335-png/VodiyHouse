import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unitsFailure } from "@/lib/admin/units/errors";
import type { UnitsEditControl } from "@/lib/admin/units/useUnitsEdit";
import ru from "@/messages/ru.json";
import { UnitsListDelete } from "./UnitsListDelete";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// «Удалить список блока»: отказ «название не то» — у поля; список уже удалили — страница
// перечитывается; «Отмена» возвращает фокус на кнопку опасной зоны.

function renderZone(removeList: UnitsEditControl["removeList"]) {
  const edit = { removeList } as unknown as UnitsEditControl;
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <UnitsListDelete blockName="A" count={3} edit={edit} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Удалить список блока" }));
  fireEvent.change(screen.getByLabelText("Введите название блока: A"), { target: { value: "а" } });
}

const submit = () =>
  act(async () => fireEvent.click(screen.getByRole("button", { name: "Удалить список" })));

describe("опасная зона «Удалить список блока»", () => {
  afterEach(() => {
    cleanup();
    refresh.mockClear();
  });

  it("база не узнала название — ошибка у поля; «Все 3 квартиры блока пропадут»", async () => {
    renderZone(vi.fn(async () => unitsFailure("confirmName")));
    expect(screen.getByText(/Все 3 квартиры блока пропадут/)).toBeTruthy();
    await submit();
    expect(screen.getByText("Название введено не так — проверьте")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("список удалил кто-то ещё — страница перечитывается", async () => {
    const removeList = vi.fn(async () => unitsFailure("notFound"));
    renderZone(removeList);
    await submit();
    expect(removeList).toHaveBeenCalledWith("а", expect.any(Function));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("«Отмена» — зона свёрнута, фокус на её кнопке", () => {
    renderZone(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Удалить список блока" }),
    );
  });
});
