import { describe, expect, it } from "vitest";
import type { UnitRecord } from "@/lib/units";
import { unitRowContext, unitRowView } from "./rowView";
import type { UnitsBlock } from "./types";

const BLOCK: UnitsBlock = {
  id: "b",
  name: "A",
  floorsTotal: 12,
  finishingId: 2,
  currency: "USD",
  unitCount: 3,
};
const LAYOUTS = [
  { id: "l1", rooms: 2, area: 64.5, available: true, priceFrom: null },
  { id: "l2", rooms: 1, area: 16.58, available: true, priceFrom: null },
];
const FINISHINGS = [
  { id: 1, name: "Чистовая", isActive: true },
  { id: 2, name: "White box", isActive: true },
];
const ctx = unitRowContext(BLOCK, LAYOUTS, FINISHINGS);

const unit = (patch: Partial<UnitRecord>): UnitRecord => ({
  id: "u",
  entrance: 1,
  floor: 2,
  position: 1,
  number: "1",
  layoutId: "l1",
  price: null,
  pricePerM2: null,
  finishingId: null,
  status: "free",
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
  ...patch,
});
const plain = (text: string | null) => text?.replace(/\s/g, " ") ?? null;

describe("ячейки строки квартиры", () => {
  it("цена целиком → и за м²; за м² → и целиком (в копейках, как база)", () => {
    const whole = unitRowView(unit({ price: 40_000 }), ctx);
    expect([plain(whole.total), plain(whole.perM2)]).toEqual(["$40 000", "$620/м²"]);
    const perM2 = unitRowView(unit({ layoutId: "l2", pricePerM2: 325 }), ctx);
    // 325 × 16,58 = 5388,50 → $5 389 (в float вышло бы 5388,4999… → $5 388).
    expect(plain(perM2.total)).toBe("$5 389");
  });

  it("без планировки: цена за м² остаётся, целиком не посчитать; без цены — пусто", () => {
    const noLayout = unitRowView(unit({ layoutId: null, pricePerM2: 600 }), ctx);
    expect([noLayout.layout, noLayout.total, plain(noLayout.perM2)]).toEqual([
      null,
      null,
      "$600/м²",
    ]);
    const noPrice = unitRowView(unit({}), ctx);
    expect([noPrice.total, noPrice.perM2]).toEqual([null, null]);
  });

  it("сум — до тысячи", () => {
    const uzs = unitRowContext({ ...BLOCK, currency: "UZS" }, LAYOUTS, FINISHINGS);
    expect(plain(unitRowView(unit({ price: 354_123_456 }), uzs).total)).toBe("354 123 000 сум");
  });

  it("отделка: своя, «как в блоке», никакой", () => {
    expect(unitRowView(unit({ finishingId: 1 }), ctx).finishing).toEqual({
      name: "Чистовая",
      inherited: false,
    });
    expect(unitRowView(unit({}), ctx).finishing).toEqual({ name: "White box", inherited: true });
    const bare = unitRowContext({ ...BLOCK, finishingId: null }, LAYOUTS, FINISHINGS);
    expect(unitRowView(unit({}), bare).finishing).toBeNull();
  });

  it("цена брони и проданной — серым", () => {
    expect(unitRowView(unit({ status: "free" }), ctx).muted).toBe(false);
    expect(unitRowView(unit({ status: "reserved" }), ctx).muted).toBe(true);
    expect(unitRowView(unit({ status: "sold" }), ctx).muted).toBe(true);
  });

  it("подпись контекста меняется только с содержимым", () => {
    const again = unitRowContext(
      { ...BLOCK },
      LAYOUTS.map((l) => ({ ...l })),
      [...FINISHINGS],
    );
    expect(again.signature).toBe(ctx.signature);
    const moved = unitRowContext(BLOCK, [{ ...LAYOUTS[0]!, area: 65 }, LAYOUTS[1]!], FINISHINGS);
    expect(moved.signature).not.toBe(ctx.signature);
  });

  it.each([
    ["валюта блока", unitRowContext({ ...BLOCK, currency: "UZS" }, LAYOUTS, FINISHINGS)],
    ["отделка блока", unitRowContext({ ...BLOCK, finishingId: 1 }, LAYOUTS, FINISHINGS)],
    [
      "имя отделки",
      unitRowContext(BLOCK, LAYOUTS, [FINISHINGS[0]!, { ...FINISHINGS[1]!, name: "Белый короб" }]),
    ],
    ["комнаты", unitRowContext(BLOCK, [{ ...LAYOUTS[0]!, rooms: 3 }, LAYOUTS[1]!], FINISHINGS)],
  ])("подпись меняется вместе с полем: %s", (_, changed) => {
    expect(changed.signature).not.toBe(ctx.signature);
  });

  it("сумы за м² — до тысячи", () => {
    const uzs = unitRowContext({ ...BLOCK, currency: "UZS" }, LAYOUTS, FINISHINGS);
    const view = unitRowView(unit({ pricePerM2: 8_320_400 }), uzs);
    expect(plain(view.perM2)).toBe("8 320 000 сум/м²");
  });
});
