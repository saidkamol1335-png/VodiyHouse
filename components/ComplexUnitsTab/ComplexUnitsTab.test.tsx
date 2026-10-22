import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffRole } from "@/lib/admin/access";
import { unitsActionsFor } from "@/lib/admin/units/access";
import type { UnitsBlock, UnitsLayout, UnitsTabActions } from "@/lib/admin/units/types";
import ru from "@/messages/ru.json";
import { ComplexUnitsTab } from "./ComplexUnitsTab";

// Вкладка «Квартиры» без списка у блока: что видит руководитель и что — менеджер (Н2, Н7, М4).
// Блок со списком (чтение, статус, правки) проверяют e2e стендов.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const action = vi.fn(() => Promise.reject(new Error("не вызывается")));
const ALL: UnitsTabActions = {
  list: {
    read: action,
    status: { set: action, revert: action },
    edit: { add: action, update: action, remove: action, removeList: action },
  },
  create: action,
  saveRisers: action,
  layoutAvailable: action,
};

const block = (patch: Partial<UnitsBlock> = {}): UnitsBlock => ({
  id: "b1",
  name: "A",
  floorsTotal: 16,
  finishingId: null,
  currency: "USD",
  unitCount: 0,
  ...patch,
});
const LAYOUT: UnitsLayout = { id: "l1", rooms: 1, area: 42.5, available: true, priceFrom: 31000 };

function renderTab(role: StaffRole, current: UnitsBlock | null, layouts: UnitsLayout[] = []) {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <ComplexUnitsTab
        view={{ blocks: current ? [current] : [], block: current, layouts, finishings: [] }}
        tabHref="/zhk/1/kvartiry"
        blocksHref="/zhk/1/bloki"
        layoutsHref="/zhk/1/planirovki"
        published
        actions={unitsActionsFor(role, ALL)}
        viewerName={null}
      />
    </NextIntlClientProvider>,
  );
}

const heading = (name: string) => screen.queryByRole("heading", { name });

afterEach(cleanup);

describe("«Квартиры» у блока без списка: руководитель и менеджер", () => {
  it("блоков нет: руководителю — «Добавить блок →», менеджеру — без ссылки", () => {
    renderTab("head", null);
    expect(screen.getByRole("link", { name: "Добавить блок →" })).toBeTruthy();
    cleanup();
    renderTab("manager", null);
    expect(screen.getByText("Блоков пока нет — их заводит руководитель.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("с планировками: оба видят «Наличие по планировкам», генератор — только руководитель", () => {
    renderTab("head", block(), [LAYOUT]);
    expect(heading("Наличие по планировкам")).toBeTruthy();
    expect(heading("Генератор списка")).toBeTruthy();
    cleanup();
    renderTab("manager", block(), [LAYOUT]);
    expect(heading("Наличие по планировкам")).toBeTruthy();
    expect(heading("Генератор списка")).toBeNull();
    expect(screen.getByText(/^Статусы квартир блока/)).toBeTruthy();
  });

  it("без планировок: руководителю о них скажет генератор, менеджеру — панель Н7", () => {
    renderTab("head", block(), []);
    expect(heading("Наличие по планировкам")).toBeNull();
    expect(screen.getByText(/У блока нет планировок — квартиры получатся без типа/)).toBeTruthy();
    cleanup();
    renderTab("manager", block(), []);
    expect(screen.getByText("У блока нет планировок — их заводит руководитель.")).toBeTruthy();
  });

  it("без этажности: руководителю — «Указать этажность →», менеджеру — только Н7", () => {
    renderTab("head", block({ floorsTotal: null }), [LAYOUT]);
    expect(screen.getByRole("link", { name: "Указать этажность →" })).toBeTruthy();
    cleanup();
    renderTab("manager", block({ floorsTotal: null }), [LAYOUT]);
    expect(heading("Наличие по планировкам")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Указать этажность →" })).toBeNull();
  });
});
