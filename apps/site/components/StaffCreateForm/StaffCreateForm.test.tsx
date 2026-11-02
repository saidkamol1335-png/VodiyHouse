import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ru from "@/messages/ru.json";
import type { CreateStaffAction } from "@/lib/admin/staff/types";
import { StaffCreateForm } from "./StaffCreateForm";

const PASSWORD = "Ab3cdEfgh7Jk";

function renderForm(action: CreateStaffAction) {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <StaffCreateForm action={action} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Добавить сотрудника" }));
}

function submit() {
  fireEvent.change(screen.getByLabelText("Имя и фамилия"), { target: { value: "Азиз Рахимов" } });
  fireEvent.change(screen.getByLabelText("Email для входа"), { target: { value: "aziz@vodiyhouse.uz" } });
  fireEvent.submit(screen.getByRole("button", { name: "Создать и показать пароль" }).closest("form")!);
}

describe("добавить сотрудника", () => {
  afterEach(cleanup);

  it("в действие уходит только FormData — прошлое состояние с паролем не отправляется", async () => {
    const action = vi.fn<CreateStaffAction>(async (formData) => ({
      status: "created",
      member: { id: "id-1", fullName: String(formData.get("fullName")), email: "aziz@vodiyhouse.uz", role: "manager" },
      password: PASSWORD,
    }));
    renderForm(action);
    submit();
    expect(await screen.findByRole("heading", { name: "Пароль для Азиз Рахимов" })).toBeTruthy();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]).toHaveLength(1);
    expect(action.mock.calls[0]![0]).toBeInstanceOf(FormData);
    expect((action.mock.calls[0]![0] as FormData).get("role")).toBe("manager");
  });

  it("после «Готово» пароля нет в разметке, панель закрыта", async () => {
    renderForm(async () => ({
      status: "created",
      member: { id: "id-1", fullName: "Азиз Рахимов", email: "aziz@vodiyhouse.uz", role: "manager" },
      password: PASSWORD,
    }));
    submit();
    await screen.findByText("Ab3c");
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(document.body.textContent).not.toContain("Ab3c");
    expect(screen.getByRole("button", { name: "Добавить сотрудника" })).toBeTruthy();
  });

  it("после ошибки роль не прыгает на «Руководитель» (React сбрасывает форму после действия)", async () => {
    renderForm(async (formData) => ({
      status: "error",
      error: null,
      fieldErrors: { fullName: "fullNameTooLong" },
      fields: { fullName: "", email: String(formData.get("email")), role: String(formData.get("role")) },
    }));
    submit();
    expect(await screen.findByText("Не длиннее 80 символов")).toBeTruthy();
    expect((screen.getByLabelText("Роль") as HTMLSelectElement).value).toBe("manager");
    expect(screen.getByText("Заявки, наличие квартир, расчёт и видео для клиентов")).toBeTruthy();
  });

  it("ошибка email — под полем, введённое остаётся", async () => {
    renderForm(async () => ({
      status: "error",
      error: null,
      fieldErrors: { email: "emailTaken" },
      fields: { fullName: "Азиз Рахимов", email: "aziz@vodiyhouse.uz", role: "videographer" },
    }));
    submit();
    expect(await screen.findByText("Сотрудник с таким email уже есть")).toBeTruthy();
    expect((screen.getByLabelText("Имя и фамилия") as HTMLInputElement).value).toBe("Азиз Рахимов");
    expect((screen.getByLabelText("Роль") as HTMLSelectElement).value).toBe("videographer");
  });
});
