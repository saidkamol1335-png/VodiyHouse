import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_COMPLEX_ROWS } from "@/lib/admin/complexes/demo";
import type { ComplexListRow } from "@/lib/admin/complexes/list";
import { complexAccess } from "@/lib/admin/complexes/tabs";
import ru from "@/messages/ru.json";
import { ComplexList } from "./ComplexList";

// Список «ЖК» по ролям (Н2, М1): у менеджера — без пилюль и плашек публикации, без архива,
// строка — сразу «Квартиры», пустые состояния — без «добавьте» и «выберите статус».

// Пилюли статусов следят за шириной ленты; в jsdom ResizeObserver нет.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function renderList(role: "head" | "manager", rows: readonly ComplexListRow[]) {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <ComplexList rows={rows} baseHref="/admin/zhk" access={complexAccess(role)} />
    </NextIntlClientProvider>,
  );
}

const rowLinks = () => screen.queryAllByRole("link");
const ARCHIVED = DEMO_COMPLEX_ROWS.filter((row) => row.status === "archived");

afterEach(cleanup);

describe("список «ЖК»: руководитель и менеджер", () => {
  it("руководитель: пилюли статусов и плашки, строка — «Основное»", () => {
    renderList("head", DEMO_COMPLEX_ROWS);
    expect(screen.getByRole("group", { name: "Статус" })).toBeTruthy();
    expect(rowLinks()[0]!.getAttribute("href")).toMatch(/^\/admin\/zhk\/[\w-]+$/);
  });

  it("менеджер: ни пилюль, ни архива; строка ведёт на «Квартиры»", () => {
    renderList("manager", DEMO_COMPLEX_ROWS);
    expect(screen.queryByRole("group", { name: "Статус" })).toBeNull();
    expect(rowLinks()).toHaveLength(DEMO_COMPLEX_ROWS.length - ARCHIVED.length);
    for (const link of rowLinks()) expect(link.getAttribute("href")).toMatch(/\/kvartiry$/);
    expect(document.querySelector(".complex-list__status")).toBeNull();
  });

  it("менеджер: только архив — «их заводит руководитель», поиск мимо — без «выберите статус»", () => {
    expect(ARCHIVED.length).toBeGreaterThan(0);
    renderList("manager", ARCHIVED);
    expect(screen.getByText("ЖК пока нет — их заводит руководитель.")).toBeTruthy();
    cleanup();
    renderList("manager", DEMO_COMPLEX_ROWS);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "нет такого" } });
    expect(screen.getByText("Ничего не нашлось. Сбросьте поиск.")).toBeTruthy();
  });

  it("свободные только без планировки — «без планировки N», а не «нет свободных» (как на главной)", () => {
    const sample = { ...DEMO_COMPLEX_ROWS[0]!, stock: { groups: [], free: 0, partial: false } };
    renderList("head", [{ ...sample, unassigned: 12 }]);
    expect(screen.getByText("без планировки 12")).toBeTruthy();
    expect(screen.queryByText("нет свободных")).toBeNull();
  });

  it("руководитель: пустые состояния прежние", () => {
    renderList("head", []);
    expect(screen.getByText("ЖК пока нет — добавьте первый.")).toBeTruthy();
  });
});
