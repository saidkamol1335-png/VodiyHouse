import { describe, expect, it } from "vitest";
import type { UnitRecord } from "@/lib/units";
import { addDraftDefaults, addLimits, nextAddDraft, nextUnitNumber, readAddDraft } from "./addForm";
import {
  defaultPriceMode,
  priceExample,
  priceFields,
  priceMax,
  readPriceDraft,
  withoutLayoutCount,
} from "./priceForm";
import { hiddenCount, pageCheck, selectedUnits, withSelected } from "./selection";
import {
  checkUnitDraft,
  draftChanged,
  draftFromUnit,
  withField,
  type DraftField,
  type UnitDraft,
} from "./unitForm";

const unit = (number: string, fields: Partial<UnitRecord> = {}): UnitRecord => ({
  id: `u${number}`,
  entrance: 1,
  floor: 2,
  position: 1,
  number,
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status: "free",
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
  ...fields,
});
const plain = (text: string) => text.replace(/\s/g, " ");
const ids = (...numbers: string[]) => new Set(numbers.map((number) => `u${number}`));

describe("выделение квартир", () => {
  const units = [unit("1"), unit("2"), unit("3")];

  it("выделенные — по порядку списка; удалённых из списка в выделении нет", () => {
    expect(selectedUnits(units, ids("3", "1", "99")).map((item) => item.number)).toEqual([
      "1",
      "3",
    ]);
    expect(selectedUnits(units, new Set())).toEqual([]);
  });

  it("«вне фильтра» и галочка шапки — по показанным строкам", () => {
    const shown = units.slice(0, 2);
    expect(hiddenCount(selectedUnits(units, ids("1", "3")), shown)).toBe(1);
    expect(pageCheck(shown, ids("3"))).toBe("none");
    expect(pageCheck(shown, ids("1", "3"))).toBe("some");
    expect(pageCheck(shown, ids("1", "2"))).toBe("all");
  });

  it("галочки набора не трогают остальные выделенные", () => {
    expect(withSelected(ids("3"), ["u1", "u2"], true)).toEqual(ids("1", "2", "3"));
    expect(withSelected(ids("1", "2", "3"), ["u1", "u2"], false)).toEqual(ids("3"));
  });
});

describe("цена в формах кабинета", () => {
  it("режим по умолчанию: «за квартиру» — только если он общий у всех", () => {
    const total = unit("1", { price: 50_000 });
    const perM2 = unit("2", { pricePerM2: 600 });
    expect(defaultPriceMode([total, unit("3", { price: 1 })])).toBe("total");
    expect(defaultPriceMode([total, perM2])).toBe("per_m2");
    expect(defaultPriceMode([unit("4")])).toBe("per_m2");
  });

  it("черновик: пусто, не число, вне пределов; «без цены» — без суммы", () => {
    expect(readPriceDraft({ mode: "per_m2", raw: " " })).toEqual({ issue: "required" });
    expect(readPriceDraft({ mode: "total", raw: "12,5" })).toEqual({ issue: "notNumber" });
    expect(readPriceDraft({ mode: "per_m2", raw: "1 000 000 000" })).toEqual({
      issue: "outOfRange",
    });
    expect(readPriceDraft({ mode: "total", raw: "1 000 000 000" })).toEqual({
      mode: "total",
      value: 1_000_000_000,
    });
    expect(readPriceDraft({ mode: "none", raw: "620" })).toEqual({ mode: "none", value: null });
  });

  it("предел суммы — свой у цены за м²", () => {
    expect(priceMax("per_m2")).toBe(999_999_999);
    expect(priceMax("total")).toBe(999_999_999_999);
  });

  it("поля после цены — одна колонка из двух или ни одной, как в базе", () => {
    expect(priceFields({ mode: "per_m2", value: 620 })).toEqual({ price: null, pricePerM2: 620 });
    expect(priceFields({ mode: "total", value: 9 })).toEqual({ price: 9, pricePerM2: null });
    expect(priceFields({ mode: "none", value: null })).toEqual({ price: null, pricePerM2: null });
  });

  it("пример за м²: множитель как набрали, итог по правилам цены; без площади — нет", () => {
    expect(plain(priceExample(64.5, 620, "USD")!.total)).toBe("$39 990");
    const sum = priceExample(50, 8_320_500, "UZS")!;
    expect(plain(sum.perM2)).toBe("8 320 500");
    expect(plain(sum.total)).toBe("416 025 000 сум");
    expect(priceExample(null, 620, "USD")).toBeNull();
    expect(withoutLayoutCount([unit("1"), unit("2", { layoutId: "L" })])).toBe(1);
  });
});

describe("правка строки", () => {
  const initial = unit("12", { layoutId: "L1", pricePerM2: 620.5, finishingId: 3 });
  const units = [initial, unit("14"), unit("12A")];
  /** Поля, набранные в форме, — с отметкой «трогали». */
  const draft = (patch: Partial<Omit<UnitDraft, "touched">>, from: UnitRecord = initial) =>
    (Object.entries(patch) as [DraftField, never][]).reduce(
      (next, [field, value]) => withField(next, field, value),
      draftFromUnit(from),
    );

  it("нетронутая форма — патча нет: дробная цена из базы не уходит обратно", () => {
    expect(draftFromUnit(initial)).toMatchObject({ layoutId: "L1", finishingId: "3" });
    expect(checkUnitDraft(initial, draftFromUnit(initial), units)).toEqual({
      patch: null,
      issues: {},
      twin: null,
    });
  });

  it("в патче — только поменянные поля", () => {
    const check = checkUnitDraft(initial, draft({ layoutId: "", finishingId: "" }), units);
    expect(check.patch).toEqual({ layoutId: null, finishingId: null });
  });

  it("номер: неверный и занятый — ошибка без запроса; латинский двойник — предупреждение", () => {
    expect(checkUnitDraft(initial, draft({ number: "12 Б" }), units).issues).toEqual({
      number: "invalid",
    });
    expect(checkUnitDraft(initial, draft({ number: "14" }), units)).toMatchObject({
      patch: null,
      issues: { number: "taken" },
    });
    expect(checkUnitDraft(initial, draft({ number: " 12а " }), units)).toEqual({
      patch: { number: "12А" },
      issues: {},
      twin: "12A",
    });
  });

  it("правленое сравнивается со свежей строкой: вернуть цену после массовой — правка", () => {
    const changed = { ...initial, pricePerM2: 650 };
    const back = draft({ price: { mode: "per_m2", raw: "620" } });
    expect(checkUnitDraft(initial, back, [changed]).patch).toEqual({
      price: { mode: "per_m2", value: 620 },
    });
    // Планировку и номер, которые сменили стояками или другой сотрудник, тоже можно вернуть.
    const moved = { ...initial, number: "12В", layoutId: "L2" };
    expect(checkUnitDraft(initial, draft({ layoutId: "L1", number: "12" }), [moved]).patch).toEqual(
      {
        layoutId: "L1",
        number: "12",
      },
    );
    expect(draftChanged(draft({ layoutId: "L1" }), draftFromUnit(initial))).toBe(false);
    // Нетронутое не уходит, даже если строку тем временем поменяли.
    const renamed = { ...initial, number: "12Б", layoutId: "L2" };
    expect(checkUnitDraft(initial, draft({}), [renamed]).patch).toBeNull();
    // Набрали то, что уже стоит в свежей строке, — менять нечего.
    expect(
      checkUnitDraft(initial, draft({ number: "12Б", layoutId: "L2" }), [renamed]).patch,
    ).toBeNull();
  });

  it("цена: тронутая и та же — не правка; другой режим — правка; неверная — ошибка", () => {
    const same = { mode: "per_m2" as const, raw: "620,5" };
    expect(checkUnitDraft(initial, draft({ price: same }), units)).toEqual({
      patch: null,
      issues: { price: "notNumber" },
      twin: null,
    });
    const whole = unit("20", { price: 50_000 });
    const keep = draft({ price: draftFromUnit(whole).price }, whole);
    expect(checkUnitDraft(whole, keep, [whole]).patch).toBeNull();
    const perM2 = draft({ price: { mode: "per_m2", raw: "50 000" } }, whole);
    expect(checkUnitDraft(whole, perM2, [whole]).patch).toEqual({
      price: { mode: "per_m2", value: 50_000 },
    });
  });
});

describe("«+ Квартира»", () => {
  const units = [
    unit("1", { entrance: 1, floor: 2, position: 1 }),
    unit("2", { entrance: 1, floor: 2, position: 2 }),
    unit("12А", { entrance: 2, floor: 3, position: 1 }),
    unit("3/10", { entrance: 2, floor: 3, position: 2 }),
  ];
  const limits = addLimits(units, 9);

  it("пределы: подъезд и позиция — до существующих + 1, у нового подъезда — 1", () => {
    expect(limits.maxEntrance).toBe(3);
    expect([1, 2, 3].map(limits.maxPosition)).toEqual([3, 3, 1]);
    expect(addLimits([], 5).maxEntrance).toBe(1);
  });

  it("номер по умолчанию — после самого большого числового префикса", () => {
    expect(nextUnitNumber(units)).toBe("13");
    expect(nextUnitNumber([])).toBe("1");
  });

  it("место по умолчанию — первый жилой этаж, первая свободная позиция", () => {
    expect(addDraftDefaults(units, limits)).toEqual({
      entrance: "1",
      floor: "2",
      position: "3",
      number: "13",
    });
  });

  it("черновик: вне пределов, место и номер заняты — без запроса", () => {
    const draft = { entrance: "1", floor: "2", position: "2", number: "2" };
    expect(readAddDraft(draft, units, limits)).toEqual({
      issues: { slotTaken: "2", number: "taken" },
    });
    const outside = { entrance: "4", floor: "10", position: "1", number: "1 2" };
    expect(readAddDraft(outside, units, limits)).toEqual({
      issues: { entrance: true, floor: true, number: "invalid" },
    });
    expect(readAddDraft({ ...draft, entrance: "3", position: "2" }, units, limits)).toMatchObject({
      issues: { position: true },
    });
  });

  it("после «Добавить» — следующий номер и свободная позиция этажа; набранное не трогается", () => {
    const sent = { entrance: "1", floor: "2", position: "3", number: "13" };
    const placed = [...units, { entrance: 1, floor: 2, position: 3, number: "13" }];
    // На 2-м этаже 1-го подъезда заняты все три позиции — место остаётся.
    expect(nextAddDraft(sent, sent, placed)).toEqual({ ...sent, number: "14" });
    const floor5 = { ...sent, floor: "5", position: "2" };
    expect(
      nextAddDraft(floor5, floor5, [
        ...units,
        { entrance: 1, floor: 5, position: 2, number: "13" },
      ]),
    ).toEqual({
      ...floor5,
      position: "1",
      number: "14",
    });
    // Пока шёл запрос, набрали другой номер — он остаётся.
    expect(nextAddDraft(sent, { ...sent, number: "77" }, placed).number).toBe("77");
  });

  it("верный черновик → вход add_unit", () => {
    const draft = { entrance: "3", floor: "9", position: "1", number: "14a" };
    expect(readAddDraft(draft, units, limits)).toEqual({
      input: { entrance: 3, floor: 9, position: 1, number: "14A" },
    });
  });
});
