import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PROGRAMS_SCREEN } from "@/lib/admin/programs/demo";
import type { ProgramActionResult, ProgramActions } from "@/lib/admin/programs/types";
import ru from "@/messages/ru.json";
import { PaymentPrograms } from "./PaymentPrograms";

// Отказ тумблера (база: «последнюю включённую не выключить») — строкой в своей карточке, тумблер
// остаётся как был; следующее нажатие строку убирает. Стенд так не умеет: DEMO всегда соглашается.

// Пилюли застройщиков следят за шириной ленты; в jsdom ResizeObserver нет.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const refused: ProgramActionResult = { status: "error", error: "lastProgram", fieldErrors: {} };
const accepted: ProgramActionResult = { status: "done", at: 1, payload: undefined };

function renderScreen(setActive: ProgramActions["setActive"]) {
  const actions = { setActive } as unknown as ProgramActions;
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <PaymentPrograms screen={DEMO_PROGRAMS_SCREEN} actions={actions} />
    </NextIntlClientProvider>,
  );
  const kamalak = screen.getByRole("region", { name: "Kamalak Development" });
  return within(kamalak).getByRole("switch", { name: "100% оплата: на сайте" });
}

const click = (element: HTMLElement) => act(async () => fireEvent.click(element));

describe("тумблер программы: отказ базы", () => {
  afterEach(cleanup);

  it("«Нельзя выключить все программы…» — у карточки; тумблер включён, полосы нет", async () => {
    const setActive = vi.fn(async () => refused);
    const toggle = renderScreen(setActive);
    await click(toggle);
    const card = toggle.closest("li")!;
    expect(within(card).getByRole("alert").textContent).toBe(
      "Нельзя выключить все программы: у застройщика должна остаться хотя бы одна",
    );
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector(".action-toast__text")).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("следующее нажатие убирает строку; успех — полоса", async () => {
    const setActive = vi.fn().mockResolvedValueOnce(refused).mockResolvedValueOnce(accepted);
    const toggle = renderScreen(setActive);
    await click(toggle);
    await click(toggle);
    expect(within(toggle.closest("li")!).queryByRole("alert")).toBeNull();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector(".action-toast__text")?.textContent).toBe(
      "Выключено: 100% оплата — пропало из калькулятора на сайте",
    );
  });
});
