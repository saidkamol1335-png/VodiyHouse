"use client";

import { createContext, useContext } from "react";
import type { UnitRecord } from "@/lib/units";
import type { EditDirty } from "./editDirty";
import type { UnitsBlock, UnitsFinishing, UnitsLayout } from "./types";
import type { UnitsEditControl } from "./useUnitsEdit";

// Что нужно форме правки строки (12.5) в раскрытии под строкой — через контекст, а не пропсами
// строк: строки под memo, а форма открыта у одной.

export type UnitsEditContextValue = {
  edit: UnitsEditControl;
  block: UnitsBlock;
  layouts: readonly UnitsLayout[];
  finishings: readonly UnitsFinishing[];
  /** Весь список — номер-дубль ловится до запроса. */
  units: readonly UnitRecord[];
  dirty: EditDirty;
};

export const UnitsEditContext = createContext<UnitsEditContextValue | null>(null);

export const useUnitsEditContext = () => useContext(UnitsEditContext);
