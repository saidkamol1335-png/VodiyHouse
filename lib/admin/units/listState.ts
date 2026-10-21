// Список квартир блока в браузере (12.4): прочитанное с подтверждёнными правками (base) и слой
// правок, которые ещё сохраняются (pending). Тап меняет строку и счётчики сразу, отказ — откат
// слоя; новое чтение во время тапа слой не стирает. Строки без правок остаются теми же
// объектами — строки списка сравниваются по ссылке.

import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import {
  reuseUnchanged,
  sortUnitsByNumber,
  withStatuses,
  type UnitRecord,
  type UnitStamp,
  type UnitStatus,
} from "@/lib/units";

/** op — номер действия: подтверждение снимает только свои правки, а не правки следующего тапа. */
export type PendingStatus = { status: UnitStatus; op: number };

export type UnitsListState = {
  /** null — ещё не прочитано. */
  base: readonly UnitRecord[] | null;
  pending: ReadonlyMap<string, PendingStatus>;
  /** Сменили статус — строка остаётся под фильтром статуса до смены фильтра. */
  sticky: ReadonlySet<string>;
  reading: boolean;
  /** Отказ последнего чтения; прежний список при этом остаётся на экране. */
  readError: ContentErrorCode | null;
};

export type UnitsListEvent =
  | { type: "readStarted" }
  | { type: "readDone"; units: readonly UnitRecord[] }
  | { type: "readFailed"; error: ContentErrorCode }
  | { type: "statusSent"; op: number; changes: ReadonlyMap<string, UnitStatus> }
  | {
      type: "statusSettled";
      op: number;
      /** null — не сохранилось: строки возвращаются к прочитанному. */
      applied: ReadonlyMap<string, UnitStatus> | null;
      stamp: UnitStamp;
    }
  | { type: "filterChanged" };

export const INITIAL_UNITS_LIST: UnitsListState = {
  base: null,
  pending: new Map(),
  sticky: new Set(),
  reading: true,
  readError: null,
};

function withoutOp(pending: ReadonlyMap<string, PendingStatus>, op: number) {
  return new Map([...pending].filter(([, item]) => item.op !== op));
}

function sent(state: UnitsListState, op: number, changes: ReadonlyMap<string, UnitStatus>) {
  const pending = new Map(state.pending);
  const sticky = new Set(state.sticky);
  for (const [id, status] of changes) {
    pending.set(id, { status, op });
    sticky.add(id);
  }
  return { ...state, pending, sticky };
}

export function unitsListReducer(state: UnitsListState, event: UnitsListEvent): UnitsListState {
  switch (event.type) {
    case "readStarted":
      return { ...state, reading: true, readError: null };
    case "readDone":
      return {
        ...state,
        base: reuseUnchanged(state.base, sortUnitsByNumber(event.units)),
        reading: false,
        readError: null,
      };
    case "readFailed":
      return { ...state, reading: false, readError: event.error };
    case "statusSent":
      return sent(state, event.op, event.changes);
    case "statusSettled":
      return {
        ...state,
        pending: withoutOp(state.pending, event.op),
        base:
          state.base && event.applied
            ? withStatuses(state.base, event.applied, event.stamp)
            : state.base,
      };
    case "filterChanged":
      return state.sticky.size === 0 ? state : { ...state, sticky: new Set() };
  }
}

/** Что на экране: прочитанное и поверх — правки, которые ещё сохраняются. */
export function visibleUnits(state: UnitsListState): readonly UnitRecord[] {
  if (!state.base) return [];
  if (state.pending.size === 0) return state.base;
  return state.base.map((unit) => {
    const pending = state.pending.get(unit.id);
    return pending && pending.status !== unit.status ? { ...unit, status: pending.status } : unit;
  });
}

/** Статусы по прочитанному (без слоя) — с ними сверяется ответ «что было в базе». */
export function confirmedStatuses(
  state: UnitsListState,
  ids: readonly string[],
): Map<string, UnitStatus> {
  const wanted = new Set(ids);
  return new Map(
    (state.base ?? [])
      .filter((unit) => wanted.has(unit.id))
      .map((unit) => [unit.id, unit.status] as const),
  );
}
