// Список квартир блока (Н1): фильтры над таблицей — статус пилюлями со счётчиками, подъезд и
// комнаты чипами, этаж «от — до», поиск по номеру («Решаю сам» шага 12). Чистые функции: экран
// фильтрует весь блок (до 5000 квартир) в браузере, «Выбрать все N» берёт отфильтрованное.

import { compareUnitNumbers, foldUnitNumber } from "./number";
import type { UnitRecord } from "./record";
import { ROOM_GROUPS, roomGroupOf, type RoomGroup } from "./rooms";
import type { UnitStatus } from "./status";

/** «none» — квартира без планировки (стояку её ещё не назначили). */
export type UnitRoomFilter = RoomGroup | "none";

export type UnitFilter = {
  /** null — все статусы. */
  status: UnitStatus | null;
  /** Пусто — все подъезды / все комнаты. */
  entrances: readonly number[];
  rooms: readonly UnitRoomFilter[];
  floorFrom: number | null;
  floorTo: number | null;
  query: string;
};

export const EMPTY_UNIT_FILTER: UnitFilter = {
  status: null,
  entrances: [],
  rooms: [],
  floorFrom: null,
  floorTo: null,
  query: "",
};

/** Комнаты планировки по её id — у квартиры своих комнат нет (решение фазы 1). */
export type RoomsByLayout = ReadonlyMap<string, number>;

function roomFilterOf(unit: UnitRecord, roomsByLayout: RoomsByLayout): UnitRoomFilter {
  const rooms = unit.layoutId === null ? undefined : roomsByLayout.get(unit.layoutId);
  return rooms === undefined ? "none" : roomGroupOf(rooms);
}

/** Все фильтры, кроме статуса; запрос сворачивается один раз на список, а не на квартиру. */
function exceptStatus(filter: UnitFilter, roomsByLayout: RoomsByLayout) {
  const wanted = foldUnitNumber(filter.query);
  return (unit: UnitRecord) =>
    (filter.entrances.length === 0 || filter.entrances.includes(unit.entrance)) &&
    (filter.rooms.length === 0 || filter.rooms.includes(roomFilterOf(unit, roomsByLayout))) &&
    (filter.floorFrom === null || unit.floor >= filter.floorFrom) &&
    (filter.floorTo === null || unit.floor <= filter.floorTo) &&
    (wanted === "" || foldUnitNumber(unit.number).includes(wanted));
}

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * keep — квартиры, которым только что сменили статус: остаются в списке до смены фильтра, хотя
 * статус уже не тот («Свободны» → тап «бронь» — строка не пропадает из-под пальца).
 */
export function filterUnits(
  units: readonly UnitRecord[],
  filter: UnitFilter,
  roomsByLayout: RoomsByLayout,
  keep: ReadonlySet<string> = NO_IDS,
): UnitRecord[] {
  const matches = exceptStatus(filter, roomsByLayout);
  return units.filter(
    (unit) =>
      (filter.status === null || unit.status === filter.status || keep.has(unit.id)) &&
      matches(unit),
  );
}

/** Сколько фильтров, кроме статуса, включено — число на кнопке «Фильтры · N» (390). */
export function activeFilterCount(filter: UnitFilter): number {
  return (
    filter.entrances.length +
    filter.rooms.length +
    (filter.floorFrom !== null || filter.floorTo !== null ? 1 : 0) +
    (filter.query.trim() === "" ? 0 : 1)
  );
}

export type UnitStatusCounts = Record<UnitStatus | "all", number>;

/** Счётчики на пилюлях статуса — по остальным фильтрам, иначе выбранная пилюля обнулила бы соседние. */
export function countUnitStatuses(
  units: readonly UnitRecord[],
  filter: UnitFilter,
  roomsByLayout: RoomsByLayout,
): UnitStatusCounts {
  const counts: UnitStatusCounts = { all: 0, free: 0, reserved: 0, sold: 0 };
  const matches = exceptStatus(filter, roomsByLayout);
  for (const unit of units) {
    if (!matches(unit)) continue;
    counts.all += 1;
    counts[unit.status] += 1;
  }
  return counts;
}

export type UnitFilterOptions = {
  entrances: number[];
  rooms: UnitRoomFilter[];
  /** null — квартир нет. */
  floors: { min: number; max: number } | null;
};

/** Какие чипы показывать: только подъезды, комнаты и этажи, что есть в блоке. */
export function unitFilterOptions(
  units: readonly UnitRecord[],
  roomsByLayout: RoomsByLayout,
): UnitFilterOptions {
  const entrances = new Set<number>();
  const rooms = new Set<UnitRoomFilter>();
  let floors: UnitFilterOptions["floors"] = null;
  for (const unit of units) {
    entrances.add(unit.entrance);
    rooms.add(roomFilterOf(unit, roomsByLayout));
    floors = floors
      ? { min: Math.min(floors.min, unit.floor), max: Math.max(floors.max, unit.floor) }
      : { min: unit.floor, max: unit.floor };
  }
  return {
    entrances: [...entrances].sort((a, b) => a - b),
    rooms: [...ROOM_GROUPS, "none" as const].filter((group) => rooms.has(group)),
    floors,
  };
}

export function sortUnitsByNumber(units: readonly UnitRecord[]): UnitRecord[] {
  return [...units].sort((a, b) => compareUnitNumbers(a.number, b.number));
}

/**
 * Чипы на экране: что есть в блоке и что уже включено. Включённое значение могло пропасть из
 * блока (квартирам назначили планировку — «без пл.» исчезло): его чип остаётся, чтобы его можно
 * было снять, а не искать «Сбросить».
 */
export function shownFilterOptions(
  options: UnitFilterOptions,
  filter: UnitFilter,
): Pick<UnitFilterOptions, "entrances" | "rooms"> {
  const entrances = [...new Set([...options.entrances, ...filter.entrances])].sort((a, b) => a - b);
  const rooms = new Set<UnitRoomFilter>([...options.rooms, ...filter.rooms]);
  return {
    entrances,
    rooms: [...ROOM_GROUPS, "none" as const].filter((group) => rooms.has(group)),
  };
}
