"use client";

import { useEffect, useState } from "react";
import { settle } from "@/lib/ui/settle";
import type { UnitRecord } from "@/lib/units";
import { lostBar, nextBarOp, noteBar } from "./bar";
import { editFailed, reloadsAfterEdit, type EditMessage, type EditWhat } from "./editOutcome";
import { unitsFailure } from "./errors";
import { fieldEdits, removeEdits } from "./massEdits";
import type { UnitsListEvent } from "./listState";
import { statusSubject, type StatusSubject } from "./statusOutcome";
import type {
  AddUnitInput,
  PriceChange,
  UnitPatch,
  UnitsActionError,
  UnitsEditActions,
  UnitsResult,
} from "./types";
import type { UnitsBarControl } from "./useUnitsBar";
import type { UnitsListStore } from "./useUnitsList";

// Правки руководителя (12.5): ответ базы ложится в прочитанный список (без перечитывания) и в
// общую полосу; отказ возвращается форме, а если формы уже нет — строкой в полосе. Перечитывание
// — только после отказов, на которых список мог устареть (editOutcome). Все вызовы — через
// track: пока правка сохраняется, список не перечитывается (ReadQueue).

/** null — сделано; иначе отказ для формы (поле, «чего не хватит ЖК»). */
export type EditReply = UnitsActionError | null;
/** Форма ещё на экране: её отказ покажет она сама, иначе — полоса. */
export type Shown = () => boolean;

export type UnitsEditControl = {
  saveRow: (unit: UnitRecord, patch: UnitPatch, shown: Shown) => Promise<EditReply>;
  addUnit: (input: Omit<AddUnitInput, "blockId">, shown: Shown) => Promise<EditReply>;
  setPrice: (units: readonly UnitRecord[], change: PriceChange, shown: Shown) => Promise<EditReply>;
  setFinishing: (
    units: readonly UnitRecord[],
    id: number | null,
    shown: Shown,
  ) => Promise<EditReply>;
  removeUnits: (units: readonly UnitRecord[], shown: Shown) => Promise<EditReply>;
  removeList: (confirm: string, shown: Shown) => Promise<EditReply>;
  /** Форма правки закрылась с несохранённым: если квартиры больше нет — строкой в полосу. */
  draftLost: (unit: UnitRecord) => void;
};

type Params = {
  blockId: string;
  blockName: string;
  viewerName: string | null;
  actions: UnitsEditActions;
  /** Список блока удалён: уведомление над генератором, полоса блока сброшена. */
  onListRemoved: (deleted: number) => void;
};

export type Context = { store: UnitsListStore; params: Params; bar: UnitsBarControl };

/** Успех: событие списка и итог в полосе (оба — по желанию). */
export type Applied = { event?: UnitsListEvent; message?: EditMessage };

async function runEdit<R extends UnitsResult<object>>(
  context: Context,
  job: { what: EditWhat; subject: StatusSubject; shown: Shown },
  call: () => Promise<R>,
  apply: (done: Extract<R, { status: "done" }>) => Applied,
): Promise<EditReply> {
  const { store, params, bar } = context;
  const since = store.latest().filterGen;
  const result = await store.track(() => settle(call, unitsFailure("network") as R));
  const where = { blockId: params.blockId, blockName: params.blockName };
  if (result.status === "error") {
    if (!job.shown()) {
      const message = editFailed(job.what, job.subject, result);
      bar.setBar((current) => lostBar(current, { message, ...where }, nextBarOp()));
    }
    if (reloadsAfterEdit(result.error)) void store.reload();
    return result;
  }
  const { event, message } = apply(result as Extract<R, { status: "done" }>);
  if (event) store.dispatch(event.type === "unitSaved" ? { ...event, since } : event);
  if (message) bar.setBar((current) => noteBar(current, { op: nextBarOp(), ...where, message }));
  return null;
}

/** Самое свежее из рендера (список, действия, полоса) — для исполнителя вне рендера. */
class LatestContext {
  private value: Context | null = null;

  set(value: Context | null) {
    this.value = value;
  }

  get() {
    return this.value;
  }
}

function editControl(latest: LatestContext): UnitsEditControl {
  const run: Run = (job, call, apply) => {
    const context = latest.get();
    const request = context ? call(context) : null;
    if (!context || !request) return Promise.resolve(unitsFailure("forbidden"));
    return runEdit(
      context,
      job,
      () => request,
      (done) => apply(done, context),
    );
  };
  // Удалённые своим «Удалить»: их правка пропала по согласию, строка «удалили» не нужна.
  const removedHere = new Set<string>();
  return {
    ...rowEdits(run),
    ...fieldEdits(run),
    ...removeEdits(run, removedHere),
    draftLost: lostDraft(latest, removedHere),
  };
}

function lostDraft(
  latest: LatestContext,
  removedHere: ReadonlySet<string>,
): UnitsEditControl["draftLost"] {
  return (unit) => {
    // Форма уходит в той же отрисовке, что и строка: очистка её эффекта идёт раньше, чем список
    // запомнит новое состояние (useUnitsList — тоже эффектом). Сверяемся, когда отрисовка кончится.
    queueMicrotask(() => {
      const context = latest.get();
      const base = context?.store.latest().base;
      if (!context || !base || base.some((item) => item.id === unit.id)) return;
      if (removedHere.has(unit.id)) return;
      const { blockId, blockName } = context.params;
      const message = { kind: "rowGone" as const, number: unit.number };
      context.bar.setBar((current) => lostBar(current, { message, blockId, blockName }, nextBarOp()));
    });
  };
}

export type Run = <R extends UnitsResult<object>>(
  job: { what: EditWhat; subject: StatusSubject; shown: Shown },
  call: (context: Context) => Promise<R> | null,
  apply: (done: Extract<R, { status: "done" }>, context: Context) => Applied,
) => Promise<EditReply>;

/** Правка строки и «+ Квартира»: квартира — из ответа базы (с именем того, кто правил). */
function rowEdits(run: Run): Pick<UnitsEditControl, "saveRow" | "addUnit"> {
  const saved = (unit: UnitRecord): UnitsListEvent => ({ type: "unitSaved", unit });
  return {
    saveRow: (unit: UnitRecord, patch: UnitPatch, shown: Shown) =>
      run(
        { what: "row", subject: statusSubject([unit]), shown },
        ({ params }) =>
          params.actions.update?.({ blockId: params.blockId, unitId: unit.id, patch }) ?? null,
        (done) => ({
          event: saved(done.unit),
          message: { kind: "rowSaved", number: done.unit.number },
        }),
      ),
    addUnit: (input: Omit<AddUnitInput, "blockId">, shown: Shown) =>
      run(
        { what: "add", subject: { number: input.number, count: 1 }, shown },
        ({ params }) => params.actions.add?.({ ...input, blockId: params.blockId }) ?? null,
        // «Добавлена кв. N» показывает сама форма; закрыли её до ответа — итог в полосе.
        (done) => ({
          event: saved(done.unit),
          message: shown() ? undefined : { kind: "added", number: done.unit.number },
        }),
      ),
  };
}

/** null — правок нет (менеджер, 12.6). */
export function useUnitsEdit(
  store: UnitsListStore,
  params: Omit<Params, "actions"> & { actions: UnitsEditActions | null },
  bar: UnitsBarControl,
): UnitsEditControl | null {
  const { actions } = params;
  const [latest] = useState(() => new LatestContext());
  useEffect(() => {
    latest.set(actions ? { store, params: { ...params, actions }, bar } : null);
  });
  const [control] = useState(() => editControl(latest));
  return actions ? control : null;
}
