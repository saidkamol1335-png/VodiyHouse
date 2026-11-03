import { describe, expect, it } from "vitest";
import { EMPTY_UNIT_FILTER, filterUnits, countUnitStatuses, type UnitRecord } from "@vh/shared/units";
import { offSiteUnits, unitSiteGaps } from "./siteGaps";
import type { UnitsLayout } from "./types";
import { unitChecklist, unitPreview } from "./unitChecklist";
import type { UnitDraft } from "./unitForm";

// Экраны 4–5 (PLAN §10, пп. 22, 26, 27): «На сайте», «Только неполные» и чек-лист квартиры.

const LAYOUT: UnitsLayout = { id: "l1", rooms: 2, area: 54, available: true, priceFrom: null };
const unit = (patch: Partial<UnitRecord> = {}): UnitRecord => ({
  id: "u1",
  entrance: 1,
  floor: 5,
  position: 1,
  number: "41",
  layoutId: "l1",
  price: 54000,
  pricePerM2: null,
  finishingId: null,
  status: "free",
  updatedAt: "2026-11-03T08:00:00Z",
  updatedByName: null,
  ...patch,
});
const draft = (patch: Partial<UnitDraft> = {}): UnitDraft => ({
  number: "41",
  layoutId: "l1",
  price: { mode: "total", raw: "54000" },
  finishingId: "",
  touched: { number: false, layoutId: false, price: false, finishingId: false },
  ...patch,
});

describe("квартира на сайте", () => {
  const layouts = new Map([["l1", LAYOUT], ["l2", { ...LAYOUT, id: "l2", drawingMissing: true }]]);

  it("с планировкой, ценой и чертежом — на сайте; иначе — чего не хватает", () => {
    expect(unitSiteGaps(unit(), layouts)).toEqual([]);
    expect(unitSiteGaps(unit({ status: "sold" }), layouts)).toEqual([]);
    expect(unitSiteGaps(unit({ layoutId: null, price: null }), layouts)).toEqual(["layout", "price"]);
    expect(unitSiteGaps(unit({ layoutId: "l2" }), layouts)).toEqual(["drawing"]);
  });

  it("«Только неполные» оставляет квартиры без сайта и считается в пилюлях статуса", () => {
    const units = [unit(), unit({ id: "u2", number: "42", price: null }), unit({ id: "u3", number: "43", layoutId: "l2", status: "sold" })];
    const offSite = offSiteUnits(units, layouts);
    expect([...offSite]).toEqual(["u2", "u3"]);
    const filter = { ...EMPTY_UNIT_FILTER, incomplete: true };
    expect(filterUnits(units, filter, new Map(), { offSite }).map((item) => item.id)).toEqual(["u2", "u3"]);
    expect(countUnitStatuses(units, filter, new Map(), offSite)).toMatchObject({ all: 2, free: 1, sold: 1 });
    expect(filterUnits(units, EMPTY_UNIT_FILTER, new Map(), { offSite })).toHaveLength(3);
  });
});

describe("чек-лист формы квартиры (экран 5)", () => {
  it("5 пунктов по черновику формы — до сохранения", () => {
    const keys = (items: { key: string; ok: boolean }[]) => items.filter((item) => !item.ok).map((item) => item.key);
    expect(keys(unitChecklist(unit(), draft(), LAYOUT))).toEqual([]);
    expect(keys(unitChecklist(unit(), draft({ price: { mode: "none", raw: "" } }), LAYOUT))).toEqual(["price"]);
    expect(keys(unitChecklist(unit({ status: "reserved" }), draft(), { ...LAYOUT, drawingMissing: true }))).toEqual(["drawing", "free"]);
    expect(keys(unitChecklist(unit(), draft({ layoutId: "" }), null))).toEqual(["layout", "drawing", "roomsArea"]);
  });

  it("превью: цена за м² даёт цену целиком по площади планировки", () => {
    expect(unitPreview(draft({ price: { mode: "per_m2", raw: "1000" } }), LAYOUT)).toEqual({ total: 54000, perM2: 1000 });
    expect(unitPreview(draft({ price: { mode: "none", raw: "" } }), LAYOUT)).toEqual({ total: null, perM2: null });
  });
});
