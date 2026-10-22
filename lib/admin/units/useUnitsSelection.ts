"use client";

import { useCallback, useMemo, useState } from "react";
import type { UnitRecord } from "@/lib/units";
import { selectedUnits, withSelected } from "./selection";

// Галочки массовой панели (12.5): набор id; выделенные — те, что ещё есть в списке (удалённые
// другим сотрудником выпадают сами, без эффекта). Колбэки стабильны — строки списка под memo.

export type UnitsSelection = {
  ids: ReadonlySet<string>;
  selected: readonly UnitRecord[];
  toggle: (id: string, on: boolean) => void;
  setMany: (units: readonly UnitRecord[], on: boolean) => void;
  clear: () => void;
};

export function useUnitsSelection(units: readonly UnitRecord[]): UnitsSelection {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const selected = useMemo(() => selectedUnits(units, ids), [units, ids]);
  const toggle = useCallback(
    (id: string, on: boolean) => setIds((prev) => withSelected(prev, [id], on)),
    [],
  );
  const setMany = useCallback(
    (list: readonly UnitRecord[], on: boolean) =>
      setIds((prev) =>
        withSelected(
          prev,
          list.map((unit) => unit.id),
          on,
        ),
      ),
    [],
  );
  const clear = useCallback(() => setIds(new Set()), []);
  return { ids, selected, toggle, setMany, clear };
}
