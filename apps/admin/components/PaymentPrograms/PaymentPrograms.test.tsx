import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PROGRAMS_SCREEN } from "@/lib/admin/programs/demo";
import type { ProgramActionResult, ProgramActions } from "@/lib/admin/programs/types";
import ru from "@/messages/ru.json";
import { PaymentPrograms } from "./PaymentPrograms";

// Экран «Программы оплаты» без базы: отказ тумблера — строкой в карточке; обрыв связи — не
// зависший тумблер; правки открытой карточки не теряются молча; удаление — полоса.
// Стенд так не умеет: DEMO всегда соглашается.

// Пилюли застройщиков следят за шириной ленты; в jsdom ResizeObserver нет.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const refused: ProgramActionResult = { status: "error", error: "lastProgram", fieldErrors: {} };
const accepted: ProgramActionResult = { status: "done", at: 1, payload: undefined };

function renderScreen(actions: Partial<ProgramActions>) {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <PaymentPrograms screen={DEMO_PROGRAMS_SCREEN} actions={actions as ProgramActions} />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("region", { name: "Kamalak Development" });
}

const kamalakSwitch = (panel: HTMLElement) =>
  within(panel).getByRole("switch", { name: "100% оплата: на сайте" });
const click = (element: HTMLElement) => act(async () => fireEvent.click(element));
const toastText = () => document.querySelector(".action-toast__text")?.textContent;

describe("тумблер программы: отказ базы и обрыв связи", () => {
  afterEach(cleanup);

  it("«Нельзя выключить все программы…» — у карточки; тумблер включён, полосы нет", async () => {
    const toggle = kamalakSwitch(renderScreen({ setActive: vi.fn(async () => refused) }));
    await click(toggle);
    const card = toggle.closest("li")!;
    expect(within(card).getByRole("alert").textContent).toBe(
      "Нельзя выключить все программы: у застройщика должна остаться хотя бы одна",
    );
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toastText()).toBeUndefined();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("следующее нажатие убирает строку; успех — полоса", async () => {
    const setActive = vi.fn().mockResolvedValueOnce(refused).mockResolvedValueOnce(accepted);
    const toggle = kamalakSwitch(renderScreen({ setActive }));
    await click(toggle);
    await click(toggle);
    expect(within(toggle.closest("li")!).queryByRole("alert")).toBeNull();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toastText()).toBe("Выключено: 100% оплата — пропало из калькулятора на сайте");
  });

  it("обрыв связи — «Нет связи», тумблер снова доступен, экран на месте", async () => {
    const setActive = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const toggle = kamalakSwitch(renderScreen({ setActive }));
    await click(toggle);
    expect(within(toggle.closest("li")!).getByRole("alert").textContent).toBe(
      "Нет связи с сервером — попробуйте ещё раз",
    );
    expect(toggle.hasAttribute("disabled")).toBe(false);
  });
});

describe("открытая карточка", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("с правками «Изменить» у другой спрашивает «Уйти без сохранения?»; «Отмена» — правки целы", async () => {
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const panel = renderScreen({});
    await click(within(panel).getByRole("button", { name: "Изменить: 100% оплата" }));
    const discount = screen.getByLabelText("Скидка за 100 % оплату, %");
    fireEvent.change(discount, { target: { value: "11" } });
    const scheme = within(panel).getByRole("button", {
      name: "Изменить: Рассрочка от застройщика",
    });
    await click(scheme);
    expect(confirm).toHaveBeenCalledWith("Уйти без сохранения?");
    expect((screen.getByLabelText("Скидка за 100 % оплату, %") as HTMLInputElement).value).toBe(
      "11",
    );
    await click(scheme);
    expect(screen.queryByLabelText("Скидка за 100 % оплату, %")).toBeNull();
    expect(screen.getAllByTestId("program-editor")).toHaveLength(1);
  });

  it("без правок — переключается молча; удаление выключенной — полоса «Программа удалена»", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const panel = renderScreen({
      setActive: vi.fn(async () => accepted),
      remove: vi.fn(async () => accepted),
    });
    await click(kamalakSwitch(panel));
    await click(within(panel).getByRole("button", { name: "Изменить: 100% оплата" }));
    await click(within(panel).getByRole("button", { name: "Удалить" }));
    await click(within(panel).getByRole("button", { name: "Да, удалить" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(toastText()).toBe("Программа удалена");
    expect(screen.queryByTestId("program-editor")).toBeNull();
    expect(within(panel).getAllByTestId("program-card")).toHaveLength(2);
  });
});
