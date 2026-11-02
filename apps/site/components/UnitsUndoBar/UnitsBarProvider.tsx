"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { UnitsBarContext, barTimed, expireBar, type UnitsBar } from "@/lib/admin/units/bar";
import { UNITS_UNDO_MS } from "@/lib/admin/units/statusOutcome";
import { usePausableTimeout } from "@/lib/ui/usePausableTimeout";
import { UnitsBarStatus } from "./UnitsUndoBar";

/**
 * Полоса статуса — одна на вкладку «Квартиры», выше переключателя блоков: смена ?blok=
 * перерисовывает страницу, не пересоздавая её, и ответ тапа в блоке A виден и на блоке B. Часы
 * 5 с — здесь же: «Отменить» живёт 5 с от ответа базы, сколько бы блоков ни сменили. Живая
 * область полосы — тоже здесь, вне блоков (UnitsBarStatus); blockId — блок на экране.
 */
export function UnitsBarProvider({
  blockId,
  children,
}: {
  blockId: string | null;
  children: ReactNode;
}) {
  const [bar, setBar] = useState<UnitsBar | null>(null);
  // Вкладку спрятали (Next держит её в Activity) — полоса не переживает показ: смена сохранена.
  useEffect(() => () => setBar(null), []);
  const timer = usePausableTimeout(barTimed(bar) ? bar!.op : null, UNITS_UNDO_MS, () =>
    setBar(expireBar),
  );
  const value = useMemo(() => ({ bar, setBar, timer }), [bar, timer]);
  return (
    <UnitsBarContext.Provider value={value}>
      {children}
      <UnitsBarStatus bar={bar} blockId={blockId} />
    </UnitsBarContext.Provider>
  );
}
