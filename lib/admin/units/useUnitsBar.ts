"use client";

import { useCallback, useContext, useState, type Dispatch, type SetStateAction } from "react";
import { usePausableTimeout, type PausableTimer } from "@/lib/ui/usePausableTimeout";
import { UnitsBarContext, barTimed, expireBar, type UnitsBar } from "./bar";
import { UNITS_UNDO_MS } from "./statusOutcome";

// Полоса внизу вкладки «Квартиры» — общая для статуса (12.4) и правок руководителя (12.5): из
// провайдера над переключателем блоков (с его часами), а без него (тесты, отдельный экран) — своя
// со своими часами: у одной полосы одни часы.

export type UnitsBarControl = {
  bar: UnitsBar | null;
  setBar: Dispatch<SetStateAction<UnitsBar | null>>;
  timer: PausableTimer;
  dismiss: () => void;
};

export function useUnitsBar(): UnitsBarControl {
  const shared = useContext(UnitsBarContext);
  const [own, setOwn] = useState<UnitsBar | null>(null);
  const ownTimer = usePausableTimeout(
    !shared && barTimed(own) ? own!.op : null,
    UNITS_UNDO_MS,
    () => setOwn(expireBar),
  );
  const { bar, setBar, timer } = shared ?? { bar: own, setBar: setOwn, timer: ownTimer };
  const dismiss = useCallback(() => setBar(null), [setBar]);
  return { bar, setBar, timer, dismiss };
}
