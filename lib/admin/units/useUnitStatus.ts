"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { settle } from "@/lib/ui/settle";
import { usePausableTimeout, type PausableTimer } from "@/lib/ui/usePausableTimeout";
import type { UnitRecord, UnitStatus } from "@/lib/units";
import {
  UnitsBarContext,
  barTimed,
  expireBar,
  settleBar,
  startBar,
  type UnitsBar,
  type UnitsBarUndo,
} from "./bar";
import { unitsFailure } from "./errors";
import { confirmedStatuses } from "./listState";
import {
  UNITS_UNDO_MS,
  commonStatus,
  tapOutcome,
  undoOutcome,
  type StatusMessage,
  type StatusOutcome,
} from "./statusOutcome";
import type { RevertUnitsStatusResult, SetUnitsStatusResult, UnitsStatusActions } from "./types";
import type { UnitsListStore } from "./useUnitsList";

// Статус тапом (решение №7): строка меняется сразу, база отвечает — полоса «Кв. 41: свободна →
// бронь · Отменить» на 5 с от ответа (не от тапа: на медленной связи иначе не успеть отменить).
// Новый тап заменяет полосу; отказ прежнего, на который полосы уже нет, остаётся строкой (bar.ts).
// Ctrl/⌘+Z — «Отменить», пока полоса видна. Массовая смена 12.5 зовёт тот же change.

const NETWORK = unitsFailure("network");

// Номера действий — общие на модуль: полоса одна на вкладку, а хук у каждого блока свой, и ответ
// действия одного блока не должен принять полосу другого за свою.
let lastOp = 0;

export type UnitStatusControl = {
  bar: UnitsBar | null;
  timer: PausableTimer;
  change: (units: readonly UnitRecord[], to: UnitStatus) => void;
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

/** Полоса — из провайдера вкладки; без него (тесты, отдельный экран) — своя. */
function useBarState() {
  const shared = useContext(UnitsBarContext);
  const [own, setOwn] = useState<UnitsBar | null>(null);
  return shared ?? { bar: own, setBar: setOwn };
}

export function useUnitStatus(store: UnitsListStore, params: Params): UnitStatusControl {
  const { bar, setBar } = useBarState();
  const latest = useRef({ store, params, bar, setBar });
  useEffect(() => {
    latest.current = { store, params, bar, setBar };
  });
  const run = useCallback((work: StatusWork) => {
    const current = latest.current;
    const { actions } = current.params;
    if (!actions) return;
    const runner = { store: current.store, setBar: current.setBar };
    void runStatusWork(++lastOp, work, { ...runner, params: { ...current.params, actions } });
  }, []);
  const change = useCallback(
    (units: readonly UnitRecord[], to: UnitStatus) => {
      const targets = units.filter((unit) => unit.status !== to);
      if (targets.length > 0) run(tapWork(latest.current.params.blockId, targets, to));
    },
    [run],
  );
  const undo = useCallback(() => {
    const current = latest.current.bar;
    if (current?.undo && !current.busy) run(undoWork(current.undo));
  }, [run]);
  const dismiss = useCallback(() => latest.current.setBar(null), []);
  const timer = usePausableTimeout(barTimed(bar) ? bar!.op : null, UNITS_UNDO_MS, () =>
    setBar(expireBar),
  );
  useUndoShortcut(bar !== null && bar.undo !== null && !bar.busy, undo);
  return { bar, timer, change, undo, dismiss };
}

/** Одно действие со статусом: что поменять на экране, запрос, исход по ответу. */
type StatusWork = {
  changes: ReadonlyMap<string, UnitStatus>;
  shown: StatusMessage;
  send: (
    actions: UnitsStatusActions,
  ) => Promise<(confirmed: ReadonlyMap<string, UnitStatus>) => StatusOutcome>;
  undoOf: (outcome: StatusOutcome) => UnitsBarUndo | null;
};

function tapWork(blockId: string, targets: readonly UnitRecord[], to: UnitStatus): StatusWork {
  const subject = {
    number: targets.length === 1 ? targets[0]!.number : null,
    count: targets.length,
  };
  const ids = targets.map((unit) => unit.id);
  const numbers = new Map(targets.map((unit) => [unit.id, unit.number]));
  const from = commonStatus(targets.map((unit) => unit.status));
  return {
    changes: new Map(ids.map((id) => [id, to])),
    shown: { kind: "saving", subject, from, to },
    send: async (actions) => {
      const result: SetUnitsStatusResult = await settle(
        () => actions.set({ blockId, unitIds: ids, status: to }),
        NETWORK,
      );
      return (confirmed) => tapOutcome(subject, to, confirmed, result);
    },
    undoOf: (outcome) =>
      outcome.undo ? { blockId, to, groups: outcome.undo, subject, numbers } : null,
  };
}

function undoWork(undo: UnitsBarUndo): StatusWork {
  const changes = new Map<string, UnitStatus>();
  for (const group of undo.groups) for (const id of group.ids) changes.set(id, group.status);
  return {
    changes,
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
  store.dispatch({ type: "statusSent", op, changes: work.changes });
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

/** Ctrl/⌘+Z — не в поле ввода: там это отмена набора. */
function useUndoShortcut(enabled: boolean, undo: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "z" && event.code !== "KeyZ") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      undo();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [enabled, undo]);
}
