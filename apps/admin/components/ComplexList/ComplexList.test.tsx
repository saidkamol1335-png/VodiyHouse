import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_COMPLEX_ROWS } from "@/lib/admin/complexes/demo";
import type { ComplexListRow } from "@/lib/admin/complexes/list";
import { complexAccess } from "@/lib/admin/complexes/tabs";
import ru from "@/messages/ru.json";
import { ComplexList } from "./ComplexList";

// Список ЖК по ролям (экран 2, PLAN §10 пп. 6, 23; М1): менеджер видит те же вкладки и значки, но без
// архива и без кнопок статуса; у руководителя — действия в строке.

// Пилюли статусов следят за шириной ленты; в jsdom ResizeObserver нет.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const ACTIONS = {
  setStatus: async () => ({ status: "done", to: "hidden", at: 1 }) as const,
  deleteNow: async () => ({ status: "done", at: 1 }) as const,
};

function renderList(
  role: "head" | "manager",
  rows: readonly ComplexListRow[],
  pending: ReadonlySet<string> = new Set(),
) {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <ComplexList rows={rows} baseHref="/zhk" access={complexAccess(role)} pending={pending} actions={ACTIONS} />
    </NextIntlClientProvider>,
  );
}

const rowLinks = () => [...document.querySelectorAll<HTMLAnchorElement>("a.complex-list__row")];
const ARCHIVED = DEMO_COMPLEX_ROWS.filter((row) => row.status === "archived");
const pillLabels = (group: HTMLElement) =>
  [...group.querySelectorAll("button")].map((button) => (button.textContent ?? "").replace(/\d+/g, "").trim());

afterEach(cleanup);

describe("список ЖК: руководитель и менеджер", () => {
  it("руководитель: вкладки экрана 2 по порядку, строка — «Основное», действия в строке", () => {
    renderList("head", DEMO_COMPLEX_ROWS);
    const group = screen.getByRole("group", { name: "Статус" });
    expect(pillLabels(group)).toEqual(["Все", "На сайте", "Скрытые", "Черновики", "Архив"]);
    expect(rowLinks()[0]!.getAttribute("href")).toMatch(/^\/zhk\/[\w-]+$/);
    expect(document.querySelectorAll(".complex-list__actions").length).toBe(rowLinks().length);
    fireEvent.click(within(group).getByRole("button", { name: /Архив/ }));
    expect(screen.getAllByRole("button", { name: "Удалить сейчас" })).toHaveLength(ARCHIVED.length);
    fireEvent.click(screen.getAllByRole("button", { name: "Удалить сейчас" })[0]!);
    expect(screen.getByLabelText("Чтобы подтвердить, введите название")).toBeTruthy();
  });

  it("менеджер: те же вкладки без «Архива», архивных строк нет, кнопок статуса нет", () => {
    renderList("manager", DEMO_COMPLEX_ROWS);
    const group = screen.getByRole("group", { name: "Статус" });
    expect(pillLabels(group)).toEqual(["Все", "На сайте", "Скрытые", "Черновики"]);
    expect(rowLinks()).toHaveLength(DEMO_COMPLEX_ROWS.length - ARCHIVED.length);
    for (const link of rowLinks()) expect(link.getAttribute("href")).toMatch(/^\/zhk\/[\w-]+$/);
    expect(document.querySelector(".complex-list__status")).not.toBeNull();
    expect(document.querySelector(".complex-list__actions")).toBeNull();
  });

  it("«Ожидает руководителя» — у ЖК с открытым запросом", () => {
    const row = DEMO_COMPLEX_ROWS.find((item) => item.status !== "archived")!;
    renderList("manager", DEMO_COMPLEX_ROWS, new Set([row.id]));
    expect(screen.getAllByText("Ожидает руководителя")).toHaveLength(1);
  });

  it("менеджер: поиск мимо — «Ничего не нашлось»", () => {
    renderList("manager", DEMO_COMPLEX_ROWS);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "нет такого" } });
    expect(screen.getByText(ru.admin.complexes.nothingFound)).toBeTruthy();
  });

  it("свободные только без планировки — «без планировки N», а не «нет свободных» (как на главной)", () => {
    const sample = { ...DEMO_COMPLEX_ROWS[0]!, stock: { groups: [], free: 0, partial: false } };
    renderList("head", [{ ...sample, unassigned: 12 }]);
    expect(screen.getByText("без планировки 12")).toBeTruthy();
    expect(screen.queryByText("нет свободных")).toBeNull();
  });

  it("руководитель: пустой список", () => {
    renderList("head", []);
    expect(screen.getByText("ЖК пока нет — добавьте первый.")).toBeTruthy();
  });
});
