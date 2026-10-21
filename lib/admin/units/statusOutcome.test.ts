import { describe, expect, it } from "vitest";
import type { UnitStatus } from "@/lib/units";
import { CONTENT_ERRORS } from "@/lib/admin/developers/errors";
import { unitsFailure } from "./errors";
import { reloadsAfter, tapOutcome, undoOutcome } from "./statusOutcome";
import type { RevertUnitsStatusResult, SetUnitsStatusResult } from "./types";

const ONE = { number: "41", count: 1 };
const confirmed = (status: UnitStatus) => new Map([["u41", status]]);
const set = (
  changed: number,
  undo: Array<{ status: UnitStatus; ids: string[] }>,
): SetUnitsStatusResult => ({ status: "done", changed, undo });
const revert = (
  reverted: number,
  skipped: string[] = [],
  missing = 0,
): RevertUnitsStatusResult => ({
  status: "done",
  reverted,
  skipped,
  missing,
});
const error = (code: "timeout" | "network" | "session" | "invalid" | "notFound") =>
  unitsFailure(code);

describe("тап статуса: ответ базы", () => {
  it("обычная смена — «свободна → бронь», undo для «Отменить», без перечитывания", () => {
    const outcome = tapOutcome(
      ONE,
      "reserved",
      confirmed("free"),
      set(1, [{ status: "free", ids: ["u41"] }]),
    );
    expect(outcome.message).toEqual({
      kind: "changed",
      subject: ONE,
      from: "free",
      to: "reserved",
    });
    expect(outcome.applied).toEqual(new Map([["u41", "reserved"]]));
    expect(outcome.undo).toEqual([{ status: "free", ids: ["u41"] }]);
    expect(outcome.reload).toBe(false);
  });

  it("база говорит «было продана», а в списке «свободна» — поменял другой: предупредить и перечитать", () => {
    const outcome = tapOutcome(
      ONE,
      "reserved",
      confirmed("free"),
      set(1, [{ status: "sold", ids: ["u41"] }]),
    );
    expect(outcome.message).toEqual({ kind: "raced", subject: ONE, was: "sold", to: "reserved" });
    // «Отменить» вернёт то, что было в базе, а не на экране.
    expect(outcome.undo).toEqual([{ status: "sold", ids: ["u41"] }]);
    expect(outcome.reload).toBe(true);
  });

  it("ничего не поменялось — статус уже поставил другой: без «Отменить», перечитать", () => {
    const outcome = tapOutcome(ONE, "reserved", confirmed("free"), set(0, []));
    expect(outcome.message).toEqual({ kind: "same", subject: ONE, to: "reserved", raced: true });
    expect(outcome.undo).toBeNull();
    expect(outcome.applied).toEqual(new Map([["u41", "reserved"]]));
    expect(outcome.reload).toBe(true);
  });

  it("ничего не поменялось — список и база уже согласны (прежний тап): без перечитывания", () => {
    const outcome = tapOutcome(ONE, "free", confirmed("free"), set(0, []));
    expect(outcome.message).toEqual({ kind: "same", subject: ONE, to: "free", raced: false });
    expect(outcome.reload).toBe(false);
  });

  it("отказ: ничего не записать; перечитать — кроме отказов, на которых упадёт и чтение", () => {
    const timeout = tapOutcome(ONE, "sold", confirmed("free"), error("timeout"));
    expect(timeout).toMatchObject({ applied: null, undo: null, reload: true });
    expect(timeout.message).toEqual({ kind: "failed", subject: ONE, error: "timeout" });
  });

  it.each(CONTENT_ERRORS)("перечитать после отказа %s?", (code) => {
    // Чтение упадёт с тем же отказом — незачем; «нет связи» — ответ мог потеряться после записи.
    const same = ["invalid", "session", "forbidden", "notConfigured"].includes(code);
    expect(reloadsAfter(code)).toBe(!same);
  });

  it("массово: гонка у одной из двух — предупреждение без общего «было» и перечитывание", () => {
    const many = new Map<string, UnitStatus>([
      ["a", "free"],
      ["b", "free"],
    ]);
    const outcome = tapOutcome(
      { number: null, count: 2 },
      "reserved",
      many,
      set(2, [
        { status: "free", ids: ["a"] },
        { status: "sold", ids: ["b"] },
      ]),
    );
    expect(outcome.message).toMatchObject({ kind: "raced", was: null, to: "reserved" });
    expect(outcome.reload).toBe(true);
  });

  it("массово (12.5): «было» — общее или пусто у смешанной выборки", () => {
    const many = new Map<string, UnitStatus>([
      ["a", "free"],
      ["b", "reserved"],
    ]);
    const outcome = tapOutcome(
      { number: null, count: 2 },
      "sold",
      many,
      set(2, [
        { status: "free", ids: ["a"] },
        { status: "reserved", ids: ["b"] },
      ]),
    );
    expect(outcome.message).toMatchObject({ kind: "changed", from: null, to: "sold" });
    expect(outcome.reload).toBe(false);
  });
});

describe("«Отменить»: ответ базы", () => {
  const UNDO = [{ status: "free" as const, ids: ["u41"] }];
  const NUMBERS = new Map([["u41", "41"]]);

  it("вернули — статус из undo, без перечитывания", () => {
    const outcome = undoOutcome(ONE, UNDO, NUMBERS, revert(1));
    expect(outcome.message).toEqual({ kind: "reverted", subject: ONE, to: "free" });
    expect(outcome.applied).toEqual(new Map([["u41", "free"]]));
    expect(outcome.reload).toBe(false);
  });

  it("квартиру поменяли после тапа или удалили — не трогаем её, перечитываем", () => {
    const skipped = undoOutcome(ONE, UNDO, NUMBERS, revert(0, ["41"]));
    expect(skipped.message).toEqual({ kind: "revertPartial", skipped: ["41"], missing: 0 });
    expect(skipped.applied).toEqual(new Map());
    expect(skipped.reload).toBe(true);
    const missing = undoOutcome(ONE, UNDO, NUMBERS, revert(0, [], 1));
    expect(missing.message).toMatchObject({ kind: "revertPartial", missing: 1 });
    expect(missing.reload).toBe(true);
  });

  it("нечего отменять — в базе уже прежний статус: записать его и перечитать", () => {
    const nothing = undoOutcome(ONE, UNDO, NUMBERS, revert(0));
    expect(nothing.message).toEqual({ kind: "nothing" });
    expect(nothing.applied).toEqual(new Map([["u41", "free"]]));
    expect(nothing.reload).toBe(true);
  });

  it("отказ «Отменить» — сообщение и перечитать по тем же правилам", () => {
    const failed = undoOutcome(ONE, UNDO, NUMBERS, error("notFound"));
    expect(failed.message).toEqual({ kind: "revertFailed", subject: ONE, error: "notFound" });
    expect(failed).toMatchObject({ applied: null, reload: true });
  });
});
