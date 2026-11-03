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

// PLAN §10, п. 6: менеджер ведёт квартиры наравне с руководителем — экран у обоих один.
describe.each(["head", "manager"] as const)("«Квартиры» у блока без списка: %s", (role) => {
  it("блоков нет — «Добавить блок →»", () => {
    renderTab(role, null);
    expect(screen.getByRole("link", { name: "Добавить блок →" })).toBeTruthy();
  });

  it("с планировками — «Наличие по планировкам» и генератор", () => {
    renderTab(role, block(), [LAYOUT]);
    expect(heading("Наличие по планировкам")).toBeTruthy();
    expect(heading("Генератор списка")).toBeTruthy();
  });

  it("без планировок — о них скажет генератор", () => {
    renderTab(role, block(), []);
    expect(heading("Наличие по планировкам")).toBeNull();
    expect(screen.getByText(/У блока нет планировок — квартиры получатся без типа/)).toBeTruthy();
  });

  it("без этажности — «Указать этажность →»", () => {
    renderTab(role, block({ floorsTotal: null }), [LAYOUT]);
    expect(screen.getByRole("link", { name: "Указать этажность →" })).toBeTruthy();
  });
});
