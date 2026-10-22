import { describe, expect, it } from "vitest";
import { lostBar, noteBar, startBar, withoutBlock, type UnitsBar } from "./bar";
import { editFailed, editTone, fieldOf, reloadsAfterEdit, type EditMessage } from "./editOutcome";
import { unitsFailure } from "./errors";

const MANY = { number: null, count: 3 };
const block = { blockId: "a", blockName: "A" };
const failed = editFailed("price", MANY, unitsFailure("timeout"));
const priced = (changed: number, withoutLayout: number): EditMessage => ({
  kind: "priced",
  subject: MANY,
  changed,
  withoutLayout,
  none: false,
});

describe("исход правок руководителя", () => {
  it("поле для подсветки: номер и место — по коду отказа, остальное — из базы", () => {
    expect(fieldOf(unitsFailure("unitNumberTaken"))).toBe("number");
    expect(fieldOf(unitsFailure("unitSlotTaken"))).toBe("slot");
    expect(fieldOf(unitsFailure("invalid", "layout_id"))).toBe("layout_id");
    expect(fieldOf(unitsFailure("timeout"))).toBeNull();
  });

  it("перечитать — когда список мог устареть, а не после отказа по правилу", () => {
    // «Весь список» и «5000» экран проверяет сам: если их вернула база, блок поменяли.
    for (const error of ["unitNumberTaken", "network", "wholeList", "unitsLimit"] as const)
      expect(reloadsAfterEdit(error)).toBe(true);
    for (const error of ["confirmName", "notReady", "invalid"] as const)
      expect(reloadsAfterEdit(error)).toBe(false);
  });

  it("тон: ничего не поменялось или квартиры без планировки — заметка", () => {
    expect(editTone(priced(2, 0))).toBe("success");
    expect(editTone(priced(0, 0))).toBe("notice");
    expect(editTone(priced(2, 1))).toBe("notice");
    expect(editTone({ kind: "finished", subject: MANY, changed: 0 })).toBe("notice");
    expect(editTone({ kind: "deleted", count: 3 })).toBe("success");
    expect(editTone(failed)).toBe("error");
    expect(editTone({ kind: "rowGone", number: "41" })).toBe("error");
  });
});

describe("полоса после правок", () => {
  const shown = (message: EditMessage, op = 1): UnitsBar =>
    noteBar(null, { op, ...block, message });

  it("итог правки — своя полоса без «Отменить» и без «Сохраняем…»", () => {
    expect(shown(priced(2, 0))).toEqual({
      op: 1,
      ...block,
      message: priced(2, 0),
      busy: false,
      undo: null,
      lost: [],
    });
  });

  it("новое действие не стирает показанную ошибку — она остаётся строкой", () => {
    const next = startBar(shown(failed), {
      op: 2,
      ...block,
      message: { kind: "deleted", count: 1 },
    });
    expect(next.lost).toEqual([{ message: failed, ...block }]);
    // Успех на полосе строкой не остаётся.
    expect(noteBar(shown(priced(2, 0)), { op: 3, ...block, message: failed }).lost).toEqual([]);
  });

  it("удалили список блока: его полоса и строки уходят, строки других блоков остаются", () => {
    const other = { message: failed, blockId: "b", blockName: "B" };
    const own = { message: failed, ...block };
    const mine = { ...shown(priced(2, 0)), lost: [own, other] };
    expect(withoutBlock(mine, "a")).toMatchObject({
      blockId: "b",
      message: failed,
      busy: false,
      undo: null,
      lost: [],
    });
    expect(withoutBlock({ ...mine, lost: [own] }, "a")).toBeNull();
    const theirs = { ...shown(priced(2, 0)), blockId: "b", lost: [own, other] };
    expect(withoutBlock(theirs, "a")?.lost).toEqual([other]);
    expect(withoutBlock(null, "a")).toBeNull();
  });

  it("отказ правки с закрытой формой — строкой в текущей полосе, без полосы — своей", () => {
    const current = shown(priced(2, 0));
    expect(lostBar(current, { message: failed, ...block }, 5)).toEqual({
      ...current,
      lost: [{ message: failed, ...block }],
    });
    expect(lostBar(null, { message: failed, ...block }, 5)).toMatchObject({
      op: 5,
      message: failed,
      busy: false,
      lost: [],
    });
  });
});
