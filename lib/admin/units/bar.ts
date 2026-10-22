// Полоса статуса квартир (12.4): что в ней и как она меняется — чистые функции и общий контекст.
// Полоса одна на вкладку «Квартиры» (провайдер над переключателем блоков): ответ, пришедший после
// смены блока, «×» или следующего тапа, не теряется — отказ остаётся строкой до «×».

import { createContext, type Dispatch, type SetStateAction } from "react";
import type { UnitStatus, UnitsUndo } from "@/lib/units";
import { editTone, type EditMessage } from "./editOutcome";
import type { StatusMessage, StatusOutcome, StatusSubject } from "./statusOutcome";

/** Что в полосе: статус (тап, «Отменить») или правка руководителя (12.5). */
export type BarMessage = StatusMessage | EditMessage;

// Номера действий — общие на модуль: полоса одна на вкладку, а хуки у каждого блока свои, и ответ
// действия одного блока не должен принять полосу другого за свою.
let lastOp = 0;
export const nextBarOp = () => ++lastOp;

export type UnitsBarUndo = {
  blockId: string;
  to: UnitStatus;
  groups: UnitsUndo;
  subject: StatusSubject;
  numbers: ReadonlyMap<string, string>;
  /** Видимые при массовой смене: после «Отменить» на месте остаются только они. */
  keep?: ReadonlySet<string>;
};

/** Отказ прежнего тапа, чью полосу уже сменили: показывается строкой до «×». */
export type UnitsBarLost = { message: BarMessage; blockId: string; blockName: string };

export type UnitsBar = {
  op: number;
  blockId: string;
  blockName: string;
  message: BarMessage;
  /** Сохраняется или отменяется — «Отменить» пока недоступна. */
  busy: boolean;
  undo: UnitsBarUndo | null;
  lost: UnitsBarLost[];
};

export type UnitsBarTone = "success" | "notice" | "error";

export function barTone(message: BarMessage): UnitsBarTone {
  switch (message.kind) {
    case "rowSaved":
    case "added":
    case "priced":
    case "finished":
    case "deleted":
    case "rowGone":
    case "editFailed":
      return editTone(message);
    case "failed":
    case "revertFailed":
      return "error";
    case "raced":
    case "same":
    case "revertPartial":
    case "nothing":
      return "notice";
    default:
      return "success";
  }
}

/** Новое действие: полоса — его; отказы прежних (и ошибка на текущей полосе) остаются строками. */
export function startBar(
  current: UnitsBar | null,
  start: Pick<UnitsBar, "op" | "blockId" | "blockName" | "message">,
): UnitsBar {
  const lost = current?.lost ?? [];
  const shownError = current && !current.busy && barTone(current.message) === "error";
  const kept = shownError
    ? [
        ...lost,
        { message: current.message, blockId: current.blockId, blockName: current.blockName },
      ]
    : lost;
  return { ...start, busy: true, undo: null, lost: kept };
}

/** Итог правки руководителя — своя полоса без «Отменить» (отказы прежних остаются строками). */
export function noteBar(
  current: UnitsBar | null,
  note: Pick<UnitsBar, "op" | "blockId" | "blockName" | "message">,
): UnitsBar {
  return { ...startBar(current, note), busy: false };
}

/** Отказ правки, чья форма уже закрыта: строкой в текущей полосе, а без полосы — своей. */
export function lostBar(current: UnitsBar | null, lost: UnitsBarLost, op: number): UnitsBar {
  if (!current) return { op, ...lost, busy: false, undo: null, lost: [] };
  return { ...current, lost: [...current.lost, lost] };
}

/**
 * Ответ действия op. Полоса ещё его — показать исход. Полосу уже сменили, закрыли или вкладку
 * прятали — успех молча (смена сохранена), а отказ — строкой: иначе строка тихо откатилась бы.
 */
export function settleBar(
  current: UnitsBar | null,
  settled: Omit<UnitsBar, "busy" | "lost">,
  outcome: StatusOutcome,
): UnitsBar | null {
  if (current?.op === settled.op) return { ...settled, busy: false, lost: current.lost };
  if (outcome.applied !== null) return current;
  const lost = { message: settled.message, blockId: settled.blockId, blockName: settled.blockName };
  if (!current) return { ...settled, busy: false, undo: null, lost: [] };
  return { ...current, lost: [...current.lost, lost] };
}

/**
 * Список блока удалили: его полосы и строк больше нет; строки других блоков остаются — первая
 * становится полосой (до «×»).
 */
export function withoutBlock(current: UnitsBar | null, blockId: string): UnitsBar | null {
  if (!current) return null;
  const lost = current.lost.filter((line) => line.blockId !== blockId);
  if (current.blockId !== blockId)
    return lost.length === current.lost.length ? current : { ...current, lost };
  const [first, ...rest] = lost;
  return first ? { op: nextBarOp(), ...first, busy: false, undo: null, lost: rest } : null;
}

/**
 * Прошло 5 с: «Отменить» больше нет. Хорошая новость уходит совсем, предупреждение, ошибка и
 * отказы прежних тапов остаются до «×».
 */
export function expireBar(current: UnitsBar | null): UnitsBar | null {
  if (!current || current.busy) return current;
  if (barTone(current.message) === "success" && current.lost.length === 0) return null;
  return { ...current, undo: null };
}

/** Полоса идёт сама (5 с), пока нет «Сохраняем…»: с «Отменить» — всегда, без — только успех. */
export function barTimed(bar: UnitsBar | null): boolean {
  if (!bar || bar.busy) return false;
  return bar.undo !== null || (barTone(bar.message) === "success" && bar.lost.length === 0);
}

export type UnitsBarState = {
  bar: UnitsBar | null;
  setBar: Dispatch<SetStateAction<UnitsBar | null>>;
};

export const UnitsBarContext = createContext<UnitsBarState | null>(null);
