import { describe, expect, it } from "vitest";
import { barTimed, expireBar, settleBar, startBar, type UnitsBar } from "./bar";
import type { StatusMessage, StatusOutcome } from "./statusOutcome";

const ONE = { number: "41", count: 1 };
const saving: StatusMessage = { kind: "saving", subject: ONE, from: "free", to: "reserved" };
const changed: StatusMessage = { kind: "changed", subject: ONE, from: "free", to: "reserved" };
const failed: StatusMessage = { kind: "failed", subject: ONE, error: "timeout" };
const ok: StatusOutcome = { message: changed, applied: new Map(), undo: null, reload: false };
const lostOutcome: StatusOutcome = { message: failed, applied: null, undo: null, reload: true };
const block = { blockId: "a", blockName: "A" };
const UNDO = {
  blockId: "a",
  to: "reserved" as const,
  groups: [],
  subject: ONE,
  numbers: new Map(),
};

const busy = (op: number): UnitsBar => startBar(null, { op, ...block, message: saving });
const settled = (op: number, message: StatusMessage) => ({ op, ...block, message, undo: UNDO });

describe("полоса статуса", () => {
  it("ответ своего действия — исход и «Отменить»", () => {
    expect(settleBar(busy(1), settled(1, changed), ok)).toMatchObject({
      op: 1,
      busy: false,
      message: changed,
      undo: UNDO,
    });
  });

  it("успех прежнего тапа, чью полосу уже сменили, — молча: полоса остаётся новому", () => {
    const current = busy(2);
    expect(settleBar(current, settled(1, changed), ok)).toBe(current);
  });

  it("отказ прежнего тапа — строкой в текущей полосе; новый тап её не стирает", () => {
    const withLost = settleBar(busy(2), settled(1, failed), lostOutcome)!;
    expect(withLost.op).toBe(2);
    expect(withLost.lost).toEqual([{ message: failed, ...block }]);
    expect(startBar(withLost, { op: 3, ...block, message: saving }).lost).toHaveLength(1);
    // Ответ op 2 пришёл — строка отказа остаётся.
    expect(settleBar(withLost, settled(2, changed), ok)!.lost).toHaveLength(1);
  });

  it("ошибка на полосе и новый тап — ошибка остаётся строкой до «×»", () => {
    const error = settleBar(busy(1), settled(1, failed), lostOutcome)!;
    expect(error.message).toEqual(failed);
    const next = startBar(error, { op: 2, ...block, message: saving });
    expect(next.lost).toEqual([{ message: failed, ...block }]);
    // Успех на полосе новым тапом не копится.
    const success = settleBar(busy(3), settled(3, changed), ok)!;
    expect(startBar(success, { op: 4, ...block, message: saving }).lost).toEqual([]);
  });

  it("отказ, когда полосу закрыли «×» или вкладку прятали, — своя полоса без «Отменить»", () => {
    expect(settleBar(null, settled(1, failed), lostOutcome)).toMatchObject({
      op: 1,
      message: failed,
      undo: null,
      busy: false,
    });
    expect(settleBar(null, settled(1, changed), ok)).toBeNull();
  });

  it("5 с: успех уходит; предупреждение, ошибка и отказы прежних остаются без «Отменить»", () => {
    const done = settleBar(busy(1), settled(1, changed), ok)!;
    expect(barTimed(done)).toBe(true);
    expect(expireBar(done)).toBeNull();
    const withLost = { ...done, lost: [{ message: failed, ...block }] };
    expect(expireBar(withLost)).toMatchObject({ undo: null, lost: withLost.lost });
    const error = { ...done, message: failed, undo: null };
    expect(barTimed(error)).toBe(false);
    expect(barTimed(busy(1))).toBe(false);
    expect(expireBar(busy(1))).toMatchObject({ busy: true });
  });
});
