"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { settle } from "@/lib/ui/settle";
import type { PausableTimer } from "@/lib/ui/usePausableTimeout";
import type { UnitRecord, UnitStatus } from "@/lib/units";
import { nextBarOp, settleBar, startBar, type UnitsBar, type UnitsBarUndo } from "./bar";
import { unitsFailure } from "./errors";
import { confirmedStatuses } from "./listState";
import {
  commonStatus,
  statusSubject,
  tapOutcome,
  undoOutcome,
  type StatusMessage,
  type StatusOutcome,
} from "./statusOutcome";
import type { RevertUnitsStatusResult, SetUnitsStatusResult, UnitsStatusActions } from "./types";
import type { UnitsBarControl } from "./useUnitsBar";
import type { UnitsListStore } from "./useUnitsList";

// Статус тапом (решение №7): строка меняется сразу, база отвечает — полоса «Кв. 41: свободна →
// бронь · Отменить» на 5 с от ответа (не от тапа: на медленной связи иначе не успеть отменить).
// Новый тап заменяет полосу; отказ прежнего, на который полосы уже нет, остаётся строкой (bar.ts).
// Ctrl/⌘+Z — «Отменить», пока полоса видна. Массовая смена 12.5 зовёт тот же change.

const NETWORK = unitsFailure("network");

export type UnitStatusControl = {
  bar: UnitsBar | null;
  timer: PausableTimer;
  /** keep — видимые при фильтре: только они остаются на месте (массовая смена, скрытые выделенные). */
  change: (units: readonly UnitRecord[], to: UnitStatus, keep?: ReadonlySet<string>) => void;
  undo: () => void;
  dismiss: () => void;
};

type Params = {
  blockId: string;
  blockName: string;
  /** null — менять статус нельзя (права задаёт наличие действия). */
  actions: UnitsStatusActions | null;
  /** Имя сотрудника для «только что · имя» без нового чтения. */
  viewerName: string | null;
};

/** barControl — общая полоса вкладки (useUnitsBar): статус и правки пишут в одну. */
export function useUnitStatus(
  store: UnitsListStore,
  params: Params,
  barControl: UnitsBarControl,
): UnitStatusControl {
  const { bar, setBar, timer, dismiss } = barControl;
  const latest = useRef({ store, params, bar, setBar });
  useEffect(() => {
    latest.current = { store, params, bar, setBar };
  });
  const run = useCallback((work: StatusWork) => {
    const current = latest.current;
    const { actions } = current.params;
    if (!actions) return;
    const runner = { store: current.store, setBar: current.setBar };
    void runStatusWork(nextBarOp(), work, { ...runner, params: { ...current.params, actions } });
  }, []);
  const change = useCallback(
    (units: readonly UnitRecord[], to: UnitStatus, keep?: ReadonlySet<string>) => {
      const targets = units.filter((unit) => unit.status !== to);
      if (targets.length > 0) run(tapWork(latest.current.params.blockId, targets, to, keep));
    },
    [run],
  );
  // «Отменить» и Ctrl+Z — только в блоке тапа: здесь список, подписи и перечитывание — его.
  const undo = useCallback(() => {
    const current = latest.current.bar;
    const own = current?.undo?.blockId === latest.current.params.blockId;
    if (current?.undo && !current.busy && own) run(undoWork(current.undo));
  }, [run]);
  useUndoShortcut(
    bar !== null && bar.undo !== null && !bar.busy && bar.undo.blockId === params.blockId,
    undo,
  );
  return { bar, timer, change, undo, dismiss };
}

/** Одно действие со статусом: что поменять на экране, запрос, исход по ответу. */
type StatusWork = {
  changes: ReadonlyMap<string, UnitStatus>;
  keep?: ReadonlySet<string>;
  shown: StatusMessage;
  send: (
    actions: UnitsStatusActions,
  ) => Promise<(confirmed: ReadonlyMap<string, UnitStatus>) => StatusOutcome>;
  undoOf: (outcome: StatusOutcome) => UnitsBarUndo | null;
};

function tapWork(
  blockId: string,
  targets: readonly UnitRecord[],
  to: UnitStatus,
  keep?: ReadonlySet<string>,
): StatusWork {
  const subject = statusSubject(targets);
  const ids = targets.map((unit) => unit.id);
  const numbers = new Map(targets.map((unit) => [unit.id, unit.number]));
  const from = commonStatus(targets.map((unit) => unit.status));
  return {
    changes: new Map(ids.map((id) => [id, to])),
    keep,
    shown: { kind: "saving", subject, from, to },
    send: async (actions) => {
      const result: SetUnitsStatusResult = await settle(
        () => actions.set({ blockId, unitIds: ids, status: to }),
        NETWORK,
      );
      return (confirmed) => tapOutcome(subject, to, confirmed, result);
    },
    undoOf: (outcome) =>
      outcome.undo ? { blockId, to, groups: outcome.undo, subject, numbers, keep } : null,
  };
}

function undoWork(undo: UnitsBarUndo): StatusWork {
  const changes = new Map<string, UnitStatus>();
  for (const group of undo.groups) for (const id of group.ids) changes.set(id, group.status);
  return {
    changes,
    // «Отменить» массовой смены тоже не выводит в список скрытые фильтром выделенные.
    keep: undo.keep,
    shown: { kind: "reverting", subject: undo.subject },
    send: async (actions) => {
      const result: RevertUnitsStatusResult = await settle(
        () => actions.revert({ blockId: undo.blockId, status: undo.to, undo: undo.groups }),
        NETWORK,
      );
      return () => undoOutcome(undo.subject, undo.groups, undo.numbers, result);
    },
    undoOf: () => null,
  };
}

type Runner = {
  store: UnitsListStore;
  params: Params & { actions: UnitsStatusActions };
  setBar: Dispatch<SetStateAction<UnitsBar | null>>;
};

async function runStatusWork(op: number, work: StatusWork, { store, params, setBar }: Runner) {
  const { blockId, blockName, viewerName, actions } = params;
  store.dispatch({ type: "statusSent", op, changes: work.changes, keep: work.keep });
  setBar((current) => startBar(current, { op, blockId, blockName, message: work.shown }));
  const decide = await store.track(() => work.send(actions));
  // Сверка — с прочитанным на момент ответа: ответ на прежний тап уже лёг в список.
  const outcome = decide(confirmedStatuses(store.latest(), [...work.changes.keys()]));
  const stamp = { at: new Date().toISOString(), by: viewerName };
  store.dispatch({ type: "statusSettled", op, applied: outcome.applied, stamp });
  const settled = { op, blockId, blockName, message: outcome.message, undo: work.undoOf(outcome) };
  setBar((current) => settleBar(current, settled, outcome));
  if (outcome.reload) void store.reload();
}

// Поля набора текста: в них Ctrl/⌘+Z — отмена набора. Галочки, радио и кнопки — не они.
const TEXT_ENTRY = [
  "textarea",
  "select",
  "[contenteditable='true']",
  "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])",
].join(", ");

/** Ctrl/⌘+Z — не в поле ввода: там это отмена набора. */
function useUndoShortcut(enabled: boolean, undo: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "z" && event.code !== "KeyZ") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(TEXT_ENTRY)) return;
      // Идёт переход на другой блок (SwitchPending): уходящий блок недоступен — и «Отменить» тоже.
      if (document.querySelector("[data-units-tab][data-switching]")) return;
      event.preventDefault();
      undo();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [enabled, undo]);
}
