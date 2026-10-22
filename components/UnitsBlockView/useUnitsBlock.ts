"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useUnitsNotice } from "@/components/UnitsNotice";
import { withoutBlock } from "@/lib/admin/units/bar";
import { EditDirty } from "@/lib/admin/units/editDirty";
import { ReadyCache } from "@/lib/admin/units/readyCache";
import { unitRowContext } from "@/lib/admin/units/rowView";
import type {
  UnitsBlock,
  UnitsFinishing,
  UnitsLayout,
  UnitsListActions,
} from "@/lib/admin/units/types";
import { useUnitStatus } from "@/lib/admin/units/useUnitStatus";
import { useUnitsBar } from "@/lib/admin/units/useUnitsBar";
import { useUnitsEdit } from "@/lib/admin/units/useUnitsEdit";
import { useUnitsList } from "@/lib/admin/units/useUnitsList";
import { useUnitsListView } from "@/lib/admin/units/useUnitsListView";
import { useUnitsSelection } from "@/lib/admin/units/useUnitsSelection";
import type { UnitRecord, UnitStatus } from "@/lib/units";

export type UnitsBlockParams = {
  block: UnitsBlock;
  layouts: readonly UnitsLayout[];
  finishings: readonly UnitsFinishing[];
  actions: UnitsListActions;
  viewerName: string | null;
};

/**
 * Всё состояние блока со списком: чтение, общая полоса, статус, правки руководителя, выделение и
 * вид списка (фильтр, порция, раскрытие) — у блока, потому что их видят и список, и массовая
 * панель внизу экрана.
 */
export function useUnitsBlock({
  block,
  layouts,
  finishings,
  actions,
  viewerName,
}: UnitsBlockParams) {
  const store = useUnitsList({ blockId: block.id, read: actions.read, expectList: true });
  const bar = useUnitsBar();
  const where = { blockId: block.id, blockName: block.name, viewerName };
  const status = useUnitStatus(store, { ...where, actions: actions.status }, bar);
  const onListRemoved = useListRemovedHandler(block, bar.setBar);
  const edit = useUnitsEdit(store, { ...where, actions: actions.edit, onListRemoved }, bar);
  const selection = useUnitsSelection(store.units);
  const dirty = useDirty();
  const rowContext = useMemo(
    () => unitRowContext(block, layouts, finishings),
    [block, layouts, finishings],
  );
  const { dispatch } = store;
  const view = useUnitsListView({
    units: store.units,
    sticky: store.state.sticky,
    pinned: store.state.pinned,
    rooms: rowContext.rooms,
    onFilterChange: useCallback(() => dispatch({ type: "filterChanged" }), [dispatch]),
    dirty,
  });
  const { change } = status;
  const onStatus = useCallback((unit: UnitRecord, to: UnitStatus) => change([unit], to), [change]);
  const [readyCache] = useState(() => new ReadyCache());
  const base = store.state.base;
  const ready = base ? readyCache.get(base, block.floorsTotal) : null;
  return {
    store,
    status,
    edit,
    selection,
    dirty,
    rowContext,
    view,
    ready,
    onStatus: actions.status ? onStatus : null,
  };
}

export type UnitsBlockState = ReturnType<typeof useUnitsBlock>;

function useDirty() {
  const t = useTranslations("admin.complexes.units.edit");
  const [dirty] = useState(() => new EditDirty());
  dirty.setMessage(t("unsaved"));
  return dirty;
}

/**
 * «Удалить список блока» удался: уведомление над генератором, полоса этого блока — прочь, но
 * непрочитанные отказы других блоков остаются строками.
 */
function useListRemovedHandler(
  block: UnitsBlock,
  setBar: ReturnType<typeof useUnitsBar>["setBar"],
) {
  const setNotice = useUnitsNotice();
  return useCallback(
    (deleted: number) => {
      setNotice({ kind: "deleted", blockId: block.id, name: block.name, deleted });
      setBar((current) => withoutBlock(current, block.id));
    },
    [block.id, block.name, setBar, setNotice],
  );
}
