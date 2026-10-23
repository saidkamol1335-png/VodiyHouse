"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { FilterChips, FilterPills } from "@/components/FilterPills";
import { SearchField } from "@/components/SearchField";
import {
  activeFilterCount,
  shownFilterOptions,
  type UnitFilter,
  type UnitFilterOptions,
  type UnitRoomFilter,
  type UnitStatus,
  type UnitStatusCounts,
} from "@/lib/units";

type UnitsFiltersProps = {
  filter: UnitFilter;
  counts: UnitStatusCounts;
  options: UnitFilterOptions;
  onChange: (next: UnitFilter) => void;
};

type StatusPill = UnitStatus | "all";
const STATUS_PILLS: readonly StatusPill[] = ["all", "free", "reserved", "sold"];

/**
 * Фильтры списка («Решаю сам» шага 12): статус пилюлями со счётчиками, номер — поиском, подъезд и
 * комнаты — чипами, этаж «от — до». На узком экране чипы и этажи — под кнопкой «Фильтры · N», а
 * поиск остаётся снаружи: найти квартиру по номеру — самое частое действие.
 */
export function UnitsFilters({ filter, counts, options, onChange }: UnitsFiltersProps) {
  const t = useTranslations("admin.complexes.units.list.filters");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Поиск — снаружи панели: на кнопке «Фильтры · N» считаются только чипы и этажи.
  const inPanel = activeFilterCount({ ...filter, query: "" });
  const pills = STATUS_PILLS.map((key) => ({ key, label: t(key), count: counts[key] }));
  return (
    <div className={open ? "units-filters units-filters--open" : "units-filters"}>
      <FilterPills
        label={t("status")}
        pills={pills}
        value={filter.status ?? "all"}
        onChange={(key) => onChange({ ...filter, status: key === "all" ? null : key })}
      />
      <SearchRow
        filter={filter}
        onChange={onChange}
        panel={{ id: panelId, open, inPanel }}
        onTogglePanel={() => setOpen(!open)}
      />
      <div id={panelId} className="units-filters__panel">
        <FilterGroups filter={filter} options={options} onChange={onChange} />
        {inPanel > 0 ? (
          <button
            type="button"
            className="units-filters__reset"
            onClick={() =>
              onChange({ ...filter, entrances: [], rooms: [], floorFrom: null, floorTo: null })
            }
          >
            {t("reset")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type SearchRowProps = Pick<UnitsFiltersProps, "filter" | "onChange"> & {
  panel: { id: string; open: boolean; inPanel: number };
  /** Открыть или закрыть панель фильтров (узкий экран). */
  onTogglePanel: () => void;
};

/** Поиск по номеру и (на узком экране) «Фильтры · N». */
function SearchRow({ filter, onChange, panel, onTogglePanel }: SearchRowProps) {
  const t = useTranslations("admin.complexes.units.list.filters");
  const searchId = useId();
  return (
    <div className="units-filters__search">
      <SearchField
        id={searchId}
        label={t("search")}
        placeholder={t("searchPlaceholder")}
        value={filter.query}
        onChange={(query) => onChange({ ...filter, query })}
        className="units-filters__search-field"
        inputClassName="units-filters__search-input"
      />
      <button
        type="button"
        className="units-filters__toggle"
        aria-expanded={panel.open}
        aria-controls={panel.id}
        onClick={onTogglePanel}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {t("toggle", { count: panel.inPanel })}
      </button>
    </div>
  );
}

type GroupsProps = Pick<UnitsFiltersProps, "filter" | "options" | "onChange">;

function FilterGroups({ filter, options, onChange }: GroupsProps) {
  const t = useTranslations("admin.complexes.units.list.filters");
  const tRooms = useTranslations("admin.complexes.rooms");
  const roomLabel = (room: UnitRoomFilter) => (room === "none" ? t("roomsNone") : tRooms(room));
  const shown = shownFilterOptions(options, filter);
  return (
    <>
      {shown.entrances.length > 1 ? (
        <FilterGroup title={t("entrances")}>
          <FilterChips
            label={t("entrances")}
            chips={shown.entrances.map((n) => ({ key: n, label: String(n) }))}
            value={filter.entrances}
            onChange={(entrances) => onChange({ ...filter, entrances })}
          />
        </FilterGroup>
      ) : null}
      {shown.rooms.length > 1 ? (
        <FilterGroup title={t("rooms")}>
          <FilterChips
            label={t("rooms")}
            chips={shown.rooms.map((room) => ({ key: room, label: roomLabel(room) }))}
            value={filter.rooms}
            onChange={(rooms) => onChange({ ...filter, rooms })}
          />
        </FilterGroup>
      ) : null}
      {options.floors && options.floors.min < options.floors.max ? (
        <FilterGroup title={t("floors")}>
          <FloorRange filter={filter} floors={options.floors} onChange={onChange} />
        </FilterGroup>
      ) : null}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="units-filters__group">
      <span className="units-filters__title" aria-hidden="true">
        {title}
      </span>
      {children}
    </div>
  );
}

type FloorRangeProps = {
  filter: UnitFilter;
  floors: { min: number; max: number };
  onChange: (next: UnitFilter) => void;
};

/** «от — до»: пусто — без границы; «от» больше «до» не меняем местами — список просто пуст. */
function FloorRange({ filter, floors, onChange }: FloorRangeProps) {
  const t = useTranslations("admin.complexes.units.list.filters");
  const read = (raw: string) => {
    const value = Number(raw);
    return raw.trim() === "" || !Number.isInteger(value) ? null : value;
  };
  const input = (key: "floorFrom" | "floorTo", label: string) => (
    <input
      className="field__input units-filters__floor"
      type="number"
      inputMode="numeric"
      min={floors.min}
      max={floors.max}
      aria-label={label}
      placeholder={String(key === "floorFrom" ? floors.min : floors.max)}
      value={filter[key] ?? ""}
      onChange={(event) => onChange({ ...filter, [key]: read(event.target.value) })}
    />
  );
  return (
    <div className="units-filters__floors">
      {input("floorFrom", t("floorFrom"))}
      <span aria-hidden="true">—</span>
      {input("floorTo", t("floorTo"))}
    </div>
  );
}
