import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import type { UnitsBar } from "@/lib/admin/units/bar";
import { PausableTimer } from "@/lib/ui/usePausableTimeout";
import ru from "@/messages/ru.json";
import { UnitsUndoBar } from "./UnitsUndoBar";

// «Отменить» — только в блоке тапа и только у блока со списком: у блока без списка (UnitsBarDock,
// undoable={false}) кнопки нет и для полосы своего блока — список тапа удалили, пока шли 5 с (CO2-8).

const BAR: UnitsBar = {
  op: 1,
  blockId: "a",
  blockName: "A",
  message: { kind: "changed", subject: { number: "41", count: 1 }, from: "free", to: "reserved" },
  busy: false,
  undo: {
    blockId: "a",
    to: "reserved",
    groups: [{ status: "free", ids: ["u41"] }],
    subject: { number: "41", count: 1 },
    numbers: new Map([["u41", "41"]]),
  },
  lost: [],
};

function renderBar(props: { blockId: string; undoable?: boolean }) {
  const control = { bar: BAR, timer: new PausableTimer(), undo: () => {}, dismiss: () => {} };
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <UnitsUndoBar control={control} {...props} />
    </NextIntlClientProvider>,
  );
}

const undoButton = () => screen.queryByRole("button", { name: /Отменить/ });

describe("полоса: кнопка «Отменить»", () => {
  afterEach(cleanup);

  it("свой блок со списком — есть", () => {
    renderBar({ blockId: "a" });
    expect(undoButton()).not.toBeNull();
  });

  it("свой блок, ставший блоком без списка, — нет", () => {
    renderBar({ blockId: "a", undoable: false });
    expect(undoButton()).toBeNull();
  });

  it("другой блок — нет, полоса подписана блоком тапа", () => {
    renderBar({ blockId: "b" });
    expect(undoButton()).toBeNull();
    expect(document.querySelector(".units-undo__title")?.textContent).toMatch(/^Блок A · Кв\. 41/);
  });
});
