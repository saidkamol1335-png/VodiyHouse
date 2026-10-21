"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { UNITS_PAGE_SIZE } from "@/lib/admin/units/statusOutcome";
import {
  EMPTY_UNIT_FILTER,
  countUnitStatuses,
  filterUnits,
  unitFilterOptions,
  type RoomsByLayout,
  type UnitFilter,
  type UnitRecord,
} from "@/lib/units";

type Params = {
  units: readonly UnitRecord[];
  sticky: ReadonlySet<string>;
  rooms: RoomsByLayout;
  onFilterChange: () => void;
};

/**
 * Что видно в списке: фильтр (считается отложенно — ввод номера не ждёт пересчёта 5000 строк),
 * порция «Показать ещё» и раскрытая строка. Смена фильтра закрывает раскрытие: иначе строка,
 * вернувшаяся в список, забрала бы фокус из поля поиска.
 */
export function useUnitsListView({ units, sticky, rooms, onFilterChange }: Params) {
  const [filter, setFilter] = useState<UnitFilter>(EMPTY_UNIT_FILTER);
  const [limit, setLimit] = useState(UNITS_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const deferred = useDeferredValue(filter);
  const options = useMemo(() => unitFilterOptions(units, rooms), [units, rooms]);
  const counts = useMemo(() => countUnitStatuses(units, deferred, rooms), [units, deferred, rooms]);
  const visible = useMemo(
    () => filterUnits(units, deferred, rooms, sticky),
    [units, deferred, rooms, sticky],
  );
  const changeFilter = (next: UnitFilter) => {
    setFilter(next);
    setLimit(UNITS_PAGE_SIZE);
    setOpenId(null);
    onFilterChange();
  };
  const toggle = useCallback((id: string | null) => setOpenId(id), []);
  return {
    filter,
    busy: filter !== deferred,
    options,
    counts,
    visible,
    shown: visible.slice(0, limit),
    limit,
    showMore: () => setLimit(limit + UNITS_PAGE_SIZE),
    openId,
    toggle,
    changeFilter,
  };
}
