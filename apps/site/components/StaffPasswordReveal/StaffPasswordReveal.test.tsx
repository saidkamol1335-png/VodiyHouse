import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ru from "@/messages/ru.json";
import { StaffPasswordReveal } from "./StaffPasswordReveal";

const PROPS = { name: "Азиз Рахимов", email: "aziz@vodiyhouse.uz", password: "Ab3cdEfgh7Jk" };

function renderReveal(onDone = vi.fn()) {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <StaffPasswordReveal {...PROPS} onDone={onDone} />
    </NextIntlClientProvider>,
  );
  return onDone;
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("пароль один раз", () => {
  afterEach(cleanup);

  it("фокус на заголовке; пароль группами по 4 без пробелов внутри", () => {
    renderReveal();
    expect(document.activeElement?.textContent).toBe("Пароль для Азиз Рахимов");
    expect([...document.querySelectorAll(".staff-password__group")].map((group) => group.textContent)).toEqual([
      "Ab3c",
      "dEfg",
      "h7Jk",
    ]);
  });

  it("«Скопировать для Telegram» кладёт адрес входа, email и пароль — каждый на своей строке", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
    mockClipboard(writeText);
    renderReveal();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Скопировать для Telegram" })));
    const text = writeText.mock.calls[0]![0] as string;
    expect(text.split("\n")).toEqual([
      "Кабинет Vodiy House",
      `Вход: ${window.location.origin}/admin/vhod`,
      "Email: aziz@vodiyhouse.uz",
      "Временный пароль: Ab3cdEfgh7Jk",
      "При первом входе задайте свой пароль, потом удалите это сообщение.",
    ]);
    expect(screen.getByRole("status").textContent).toBe("Скопировано — вставьте в чат с сотрудником");
  });

  it("буфер недоступен → текст выделен в поле, подсказка скопировать вручную", async () => {
    mockClipboard(async () => {
      throw new Error("нет доступа");
    });
    renderReveal();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Скопировать для Telegram" })));
    expect(screen.getByRole("alert").textContent).toBe("Не удалось скопировать — выделите текст ниже вручную");
    const fallback = document.querySelector("textarea")!;
    expect(fallback.value).toContain("Временный пароль: Ab3cdEfgh7Jk");
    expect(document.activeElement).toBe(fallback);
  });

  it("«Готово» сообщает родителю", () => {
    const onDone = renderReveal();
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
