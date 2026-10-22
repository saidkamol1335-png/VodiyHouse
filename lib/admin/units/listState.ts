// Список квартир блока в браузере (12.4): прочитанное с подтверждёнными правками (base) и слой
// правок статуса, которые ещё сохраняются (pending). Тап меняет строку и счётчики сразу, отказ —
// откат слоя; новое чтение во время тапа слой не стирает. Правки руководителя (12.5: строка,
// «+ Квартира», цена, отделка, удаление) ложатся в base после ответа базы. Строки без правок
// остаются теми же объектами — строки списка сравниваются по ссылке.

import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import {
  reuseUnchanged,
  sortUnitsByNumber,
  withFields,
  withStatuses,
  withUnit,
  withoutUnits,
  type UnitFieldsPatch,
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
  /** Правленая или добавленная — остаётся под любым фильтром до его смены. */
  pinned: ReadonlySet<string>;
  /** Сколько раз меняли фильтр: ответ правки, отправленной до смены, строку не закрепляет. */
  filterGen: number;
  /** Сколько раз прочитали: сохранённые стояки держатся только до следующего чтения. */
  reads: number;
  reading: boolean;
  /** Отказ последнего чтения; прежний список при этом остаётся на экране. */
  readError: ContentErrorCode | null;
};

export type UnitsListEvent =
  | { type: "readStarted" }
  | { type: "readDone"; units: readonly UnitRecord[] }
  | { type: "readFailed"; error: ContentErrorCode }
  | {
      type: "statusSent";
      op: number;
      changes: ReadonlyMap<string, UnitStatus>;
      /** Какие остаются на месте под фильтром статуса; без — все (тап по видимой строке). */
      keep?: ReadonlySet<string>;
    }
  | {
      type: "statusSettled";
      op: number;
      /** null — не сохранилось: строки возвращаются к прочитанному. */
      applied: ReadonlyMap<string, UnitStatus> | null;
      stamp: UnitStamp;
    }
  /** since — filterGen на момент отправки правки (без — закрепить всегда). */
  | { type: "unitSaved"; unit: UnitRecord; since?: number }
  | { type: "unitsPatched"; ids: ReadonlySet<string>; fields: UnitFieldsPatch; stamp: UnitStamp }
  | { type: "unitsRemoved"; ids: ReadonlySet<string> }
  | { type: "filterChanged" };

export const INITIAL_UNITS_LIST: UnitsListState = {
  base: null,
  pending: new Map(),
  sticky: new Set(),
  pinned: new Set(),
  filterGen: 0,
  reads: 0,
  reading: true,
  readError: null,
};

function withoutOp(pending: ReadonlyMap<string, PendingStatus>, op: number) {
  return new Map([...pending].filter(([, item]) => item.op !== op));
}

function sent(
  state: UnitsListState,
  { op, changes, keep }: Extract<UnitsListEvent, { type: "statusSent" }>,
) {
  const pending = new Map(state.pending);
  const sticky = new Set(state.sticky);
  for (const [id, status] of changes) {
    pending.set(id, { status, op });
    if (!keep || keep.has(id)) sticky.add(id);
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
        reads: state.reads + 1,
        reading: false,
        readError: null,
      };
    case "readFailed":
      return { ...state, reading: false, readError: event.error };
    case "statusSent":
      return sent(state, event);
    case "statusSettled":
      return {
        ...state,
        pending: withoutOp(state.pending, event.op),
        base:
          state.base && event.applied
            ? withStatuses(state.base, event.applied, event.stamp)
            : state.base,
      };
    case "unitSaved":
    case "unitsPatched":
    case "unitsRemoved":
      return edited(state, event);
    case "filterChanged":
      return {
        ...state,
        sticky: state.sticky.size === 0 ? state.sticky : new Set(),
        pinned: state.pinned.size === 0 ? state.pinned : new Set(),
        filterGen: state.filterGen + 1,
      };
  }
}

type EditEvent = Extract<UnitsListEvent, { type: "unitSaved" | "unitsPatched" | "unitsRemoved" }>;

/** Ответ правки руководителя — в прочитанный список (до первого чтения править нечего). */
function edited(state: UnitsListState, event: EditEvent): UnitsListState {
  const base = state.base;
  if (!base) return state;
  if (event.type === "unitSaved") {
    const sameFilter = event.since === undefined || event.since === state.filterGen;
    return {
      ...state,
      base: withUnit(base, event.unit),
      pinned: sameFilter ? new Set([...state.pinned, event.unit.id]) : state.pinned,
    };
  }
  if (event.type === "unitsPatched")
    return { ...state, base: withFields(base, event.ids, event.fields, event.stamp) };
  const keep = <T>(entries: Iterable<[string, T]>) =>
    new Map([...entries].filter(([id]) => !event.ids.has(id)));
  return {
    ...state,
    base: withoutUnits(base, event.ids),
    pending: keep(state.pending),
    sticky: new Set([...state.sticky].filter((id) => !event.ids.has(id))),
  };
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
