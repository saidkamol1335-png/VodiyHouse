// Полоса статуса квартир (12.4): что в ней и как она меняется — чистые функции и общий контекст.
// Полоса одна на вкладку «Квартиры» (провайдер над переключателем блоков): ответ, пришедший после
// смены блока, «×» или следующего тапа, не теряется — отказ остаётся строкой до «×».

import { createContext, type Dispatch, type SetStateAction } from "react";
import type { UnitStatus, UnitsUndo } from "@/lib/units";
import type { StatusMessage, StatusOutcome, StatusSubject } from "./statusOutcome";

export type UnitsBarUndo = {
  blockId: string;
  to: UnitStatus;
  groups: UnitsUndo;
  subject: StatusSubject;
  numbers: ReadonlyMap<string, string>;
};

/** Отказ прежнего тапа, чью полосу уже сменили: показывается строкой до «×». */
export type UnitsBarLost = { message: StatusMessage; blockId: string; blockName: string };

export type UnitsBar = {
  op: number;
  blockId: string;
  blockName: string;
  message: StatusMessage;
  /** Сохраняется или отменяется — «Отменить» пока недоступна. */
  busy: boolean;
  undo: UnitsBarUndo | null;
  lost: UnitsBarLost[];
};

export type UnitsBarTone = "success" | "notice" | "error";

export function barTone(message: StatusMessage): UnitsBarTone {
  switch (message.kind) {
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
