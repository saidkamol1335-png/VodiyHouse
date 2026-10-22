"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import { settle } from "@/lib/ui/settle";
import type { UnitRecord } from "@/lib/units";
import { unitsFailure } from "./errors";
import {
  INITIAL_UNITS_LIST,
  unitsListReducer,
  visibleUnits,
  type UnitsListEvent,
  type UnitsListState,
} from "./listState";
import { ReadQueue } from "./readQueue";
import { UNITS_RELOAD_AFTER_MS } from "./statusOutcome";
import type { BlockUnitsResult, UnitsListActions } from "./types";

// Список квартир блока читается на клиенте (12.4): при показе вкладки (и при возврате к ней —
// Next держит скрытые адреса в Activity), после возврата на вкладку браузера через 10 с и
// больше (другой сотрудник мог поменять статусы), после «Стояков» и отказов. Действие из пропсов
// после каждой перерисовки страницы — новая функция, поэтому оно берётся из ref, а не из
// зависимостей эффекта: иначе каждый тап перечитывал бы 5000 строк.

const NETWORK: BlockUnitsResult = unitsFailure("network");

export type UnitsListStore = {
  state: UnitsListState;
  /** Прочитанное с правками, которые ещё сохраняются. */
  units: readonly UnitRecord[];
  dispatch: Dispatch<UnitsListEvent>;
  /** Самое свежее состояние — для ответов действий, пришедших после перерисовок. */
  latest: () => UnitsListState;
  /** true — прочитано; false — чтение не удалось (прежний список на экране). */
  reload: () => Promise<boolean>;
  track: <T>(work: () => Promise<T>) => Promise<T>;
};

type Params = {
  blockId: string;
  read: UnitsListActions["read"];
  /** У блока по данным страницы есть список: пустой ответ — список удалили, страница устарела. */
  expectList: boolean;
};

export function useUnitsList(params: Params): UnitsListStore {
  const [state, dispatch] = useReducer(unitsListReducer, INITIAL_UNITS_LIST);
  const [queue] = useState(() => new ReadQueue());
  const router = useRouter();
  const latest = useRef({ params, state, refresh: () => router.refresh() });
  useEffect(() => {
    latest.current = { params, state, refresh: () => router.refresh() };
  });
  useListReading(queue, latest, dispatch);
  const units = useMemo(() => visibleUnits(state), [state]);
  // Стабильные: «Стояки» под memo получают reload пропсом и не перерисовываются на каждую букву.
  const reload = useCallback(() => queue.reload(), [queue]);
  const track = useCallback(<T>(work: () => Promise<T>) => queue.track(work), [queue]);
  return useMemo(
    () => ({ state, units, dispatch, latest: () => latest.current.state, reload, track }),
    [state, units, reload, track],
  );
}

type Latest = { current: { params: Params; state: UnitsListState; refresh: () => void } };

function useListReading(queue: ReadQueue, latest: Latest, dispatch: Dispatch<UnitsListEvent>) {
  useEffect(() => {
    let refreshed = false;
    queue.connect(async () => {
      const { blockId, read, expectList } = latest.current.params;
      dispatch({ type: "readStarted" });
      const result = await settle(() => read({ blockId }), NETWORK);
      if (result.status === "error") {
        dispatch({ type: "readFailed", error: result.error });
        return false;
      }
      dispatch({ type: "readDone", units: result.units });
      // Один раз на показ: перечитанная страница сама уберёт список, если его и правда нет.
      if (result.units.length === 0 && expectList && !refreshed) {
        refreshed = true;
        latest.current.refresh();
      }
      return true;
    });
    queue.ensureRead();
    const stopWatching = watchReturn(() => void queue.reload());
    return () => {
      stopWatching();
      queue.disconnect();
    };
  }, [queue, latest, dispatch]);
}

/** Вернулись на вкладку браузера после долгого отсутствия — список мог устареть. */
export function watchReturn(onReturn: () => void) {
  let hiddenAt: number | null = null;
  const change = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt !== null && Date.now() - hiddenAt >= UNITS_RELOAD_AFTER_MS) onReturn();
    hiddenAt = null;
  };
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
}
