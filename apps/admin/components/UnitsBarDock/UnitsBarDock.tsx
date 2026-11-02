"use client";

import { useMemo } from "react";
import { UnitsDock } from "@/components/UnitsDock";
import { UnitsUndoBar } from "@/components/UnitsUndoBar";
import { useUnitsBar } from "@/lib/admin/units/useUnitsBar";

const NO_UNDO = () => {};

/**
 * Полоса вкладки у блока без списка (Н7, генератор): отказ тапа, сделанного в другом блоке, и
 * отказ Н7, пришедший после ухода со строки, видны и здесь. «Отменить» — только в блоке тапа.
 */
export function UnitsBarDock({ blockId }: { blockId: string }) {
  const { bar, timer, dismiss } = useUnitsBar();
  const control = useMemo(() => ({ bar, timer, dismiss, undo: NO_UNDO }), [bar, timer, dismiss]);
  return (
    <>
      {bar ? <div className="units-bar-dock__spacer" aria-hidden="true" /> : null}
      <UnitsDock>
        <UnitsUndoBar control={control} blockId={blockId} undoable={false} />
      </UnitsDock>
    </>
  );
}
