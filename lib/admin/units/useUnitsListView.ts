"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  EMPTY_UNIT_FILTER,
  countUnitStatuses,
  filterUnits,
  unitFilterOptions,
  type RoomsByLayout,
  type UnitFilter,
  type UnitRecord,
} from "@/lib/units";
import type { EditDirty } from "./editDirty";
import { UNITS_PAGE_SIZE } from "./statusOutcome";

/** Раскрытая строка: выбор статуса или правка квартиры (12.5). */
export type UnitsOpen = { id: string; mode: "status" | "edit" } | null;

type Params = {
  units: readonly UnitRecord[];
  sticky: ReadonlySet<string>;
  pinned: ReadonlySet<string>;
  rooms: RoomsByLayout;
  onFilterChange: () => void;
  /** Несохранённая правка строки: смена фильтра и другая строка сначала спрашивают. */
  dirty: EditDirty;
};

/**
 * Что видно в списке: фильтр (считается отложенно — ввод номера не ждёт пересчёта 5000 строк),
 * порция «Показать ещё» и раскрытая строка. Смена фильтра закрывает раскрытие: иначе строка,
 * вернувшаяся в список, забрала бы фокус из поля поиска.
 */
export function useUnitsListView({ units, sticky, pinned, rooms, onFilterChange, dirty }: Params) {
  const [filter, setFilter] = useState<UnitFilter>(EMPTY_UNIT_FILTER);
  const [limit, setLimit] = useState(UNITS_PAGE_SIZE);
  const { open, setOpen, openRow } = useOpenRow(dirty);
  const deferred = useDeferredValue(filter);
  const options = useMemo(() => unitFilterOptions(units, rooms), [units, rooms]);
  const counts = useMemo(() => countUnitStatuses(units, deferred, rooms), [units, deferred, rooms]);
  const list = useShownUnits({ units, sticky, pinned, rooms, filter: deferred, open, limit });
  const changeFilter = (next: UnitFilter) => {
    if (!dirty.confirmLeave()) return;
    setFilter(next);
    setLimit(UNITS_PAGE_SIZE);
    setOpen(null);
    onFilterChange();
  };
  return {
    filter,
    busy: filter !== deferred,
    options,
    counts,
    visible: list.visible,
    shown: list.shown,
    limit,
    showMore: () => setLimit(limit + UNITS_PAGE_SIZE),
    open,
    openRow,
    changeFilter,
    /** По текущему фильтру, а не отложенному: «Выбрать все» не возьмёт набор прежнего ввода.
     *  Тот же набор, что виден (с раскрытой строкой), — счётчик кнопки сходится с выбранным. */
    matchingNow: () => filterUnits(units, filter, rooms, list.shownKeep),
  };
}

/** Раскрытая строка; другая строка или закрытие — только если правку не держат (EditDirty). */
function useOpenRow(dirty: EditDirty) {
  const [open, setOpen] = useState<UnitsOpen>(null);
  /** false — правку не бросили («Уйти без сохранения?» — «Нет»): раскрытое остаётся. */
  const openRow = useCallback(
    (id: string | null, mode: "status" | "edit" = "status") => {
      if (!dirty.confirmLeave()) return false;
      setOpen(id ? { id, mode } : null);
      return true;
    },
    [dirty],
  );
  return { open, setOpen, openRow };
}

type ShownParams = Omit<Params, "onFilterChange" | "dirty"> & {
  /** Отложенный фильтр: ввод номера не ждёт пересчёта 5000 строк. */
  filter: UnitFilter;
  open: UnitsOpen;
  limit: number;
};

/** Видимые строки и порция; раскрытая строка держится и там, и там. */
function useShownUnits({ units, sticky, pinned, rooms, filter, open, limit }: ShownParams) {
  const keep = useMemo(() => ({ sticky, pinned }), [sticky, pinned]);
  // Раскрытая строка не исчезает из-под руки, если её поменяли и список перечитали.
  const shownKeep = useMemo(
    () => (open ? { sticky, pinned: new Set([...pinned, open.id]) } : keep),
    [open, sticky, pinned, keep],
  );
  const visible = useMemo(
    () => filterUnits(units, filter, rooms, shownKeep),
    [units, filter, rooms, shownKeep],
  );
  // Раскрытая строка держится и в порции: перечитанный список мог увести её за 200-ю.
  const shown = useMemo(
    () => pageWithPinned(visible, limit, shownKeep.pinned),
    [visible, limit, shownKeep],
  );
  return { shownKeep, visible, shown };
}

export type UnitsListView = ReturnType<typeof useUnitsListView>;

/**
 * Порция «Показать ещё» и закреплённые: правленая или добавленная строка за порцией (новый номер
 * — в конце списка из 5000) не пропадает из-под руки — она добавляется после порции.
 */
export function pageWithPinned(
  visible: readonly UnitRecord[],
  limit: number,
  pinned: ReadonlySet<string>,
): readonly UnitRecord[] {
  const page = visible.slice(0, limit);
  if (pinned.size === 0 || visible.length <= limit) return page;
  const extra = visible.slice(limit).filter((unit) => pinned.has(unit.id));
  return extra.length > 0 ? [...page, ...extra] : page;
}
