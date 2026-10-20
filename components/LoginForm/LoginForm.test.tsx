import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ru from "@/messages/ru.json";
import type { SignInAction, SignInState } from "@/lib/admin/auth/types";
import { LoginForm } from "./LoginForm";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));

function renderForm(action: SignInAction) {
  return render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <LoginForm action={action} devOpenHref={null} />
    </NextIntlClientProvider>,
  );
}

function submit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Пароль", { selector: "input" }), { target: { value: password } });
  fireEvent.submit(screen.getByRole("button", { name: "Войти" }).closest("form")!);
}

describe("форма входа", () => {
  afterEach(cleanup);

  it("ошибка сервера — внутри формы над «Войти», email остаётся после сброса формы", async () => {
    const action = vi.fn<SignInAction>(
      async (_state, formData): Promise<SignInState> => ({
        email: String(formData.get("email")),
        error: "invalidCredentials",
        fieldErrors: {},
      }),
    );
    renderForm(action);
    submit("dilnoza@vodiyhouse.uz", "неверный");
    expect((await screen.findByRole("alert")).textContent).toBe("Неверный email или пароль");
    await waitFor(() => expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("dilnoza@vodiyhouse.uz"));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("ошибки полей — под полями", async () => {
    renderForm(async () => ({ email: "", error: null, fieldErrors: { email: "emailRequired", password: "passwordRequired" } }));
    submit("", "");
    expect(await screen.findByText("Введите email")).toBeTruthy();
    expect(screen.getByText("Введите пароль")).toBeTruthy();
  });

  it("пока идёт вход — «Входим…», кнопка недоступна", async () => {
    renderForm(() => new Promise<SignInState>(() => undefined));
    submit("dilnoza@vodiyhouse.uz", "пароль-123");
    const button = (await screen.findByRole("button", { name: "Входим…" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});
