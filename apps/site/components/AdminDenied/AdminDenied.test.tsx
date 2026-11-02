import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import { AdminDenied } from "./AdminDenied";

// Роли раздела — из меню (ADMIN_NAV): «ЖК» с 12.6 видят руководитель и менеджер.

function renderDenied(props: Parameters<typeof AdminDenied>[0]) {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <AdminDenied {...props} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("«Раздел недоступен»", () => {
  it("раздел руководителя — «только роль «Руководитель»»", () => {
    renderDenied({ section: "Настройки", sectionKey: "settings" });
    expect(screen.getByText("Раздел доступен руководителю")).toBeTruthy();
    expect(screen.getByText("«Настройки» видит только роль «Руководитель».")).toBeTruthy();
  });

  it("«ЖК» видеографу — руководитель и менеджер, а не «только руководитель»", () => {
    renderDenied({ section: "ЖК", sectionKey: "complexes" });
    expect(screen.getByText("Раздел доступен руководителю и менеджеру")).toBeTruthy();
    expect(screen.getByText("«ЖК» видят роли «Руководитель» и «Менеджер».")).toBeTruthy();
  });

  it("без ключа раздела — как раньше", () => {
    renderDenied({ section: "Застройщики" });
    expect(screen.getByText("Раздел доступен руководителю")).toBeTruthy();
  });
});
