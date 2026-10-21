// Список квартир блока (Н1): фильтры над таблицей — статус пилюлями со счётчиками, подъезд и
// комнаты чипами, этаж «от — до», поиск по номеру («Решаю сам» шага 12). Чистые функции: экран
// фильтрует весь блок (до 5000 квартир) в браузере, «Выбрать все N» берёт отфильтрованное.

import { compareUnitNumbers, unitNumberMatches } from "./number";
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

function matchesExceptStatus(unit: UnitRecord, filter: UnitFilter, roomsByLayout: RoomsByLayout) {
  return (
    (filter.entrances.length === 0 || filter.entrances.includes(unit.entrance)) &&
    (filter.rooms.length === 0 || filter.rooms.includes(roomFilterOf(unit, roomsByLayout))) &&
    (filter.floorFrom === null || unit.floor >= filter.floorFrom) &&
    (filter.floorTo === null || unit.floor <= filter.floorTo) &&
    unitNumberMatches(unit.number, filter.query)
  );
}

export function filterUnits(
  units: readonly UnitRecord[],
  filter: UnitFilter,
  roomsByLayout: RoomsByLayout,
): UnitRecord[] {
  return units.filter(
    (unit) =>
      (filter.status === null || unit.status === filter.status) &&
      matchesExceptStatus(unit, filter, roomsByLayout),
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
  for (const unit of units) {
    if (!matchesExceptStatus(unit, filter, roomsByLayout)) continue;
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
