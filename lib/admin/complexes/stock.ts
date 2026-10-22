// Остатки по комнатам в строке списка ЖК — как «Остатки по ЖК» мокапа: «Ст 7 · 1к 10 · 4+ 3»
// и пилюля «свободно N». Данные — room_availability(): по числу комнат и валюте. Блок без списка
// квартир не знает числа (free_count = null) — у типа нет числа (PLAN §3.1), но свободные этого
// типа в блоках со списком известны (listed_free): они входят в «свободно N+» и «2к 18+».

import { ROOM_GROUPS, roomGroupOf, type RoomGroup } from "@/lib/units/rooms";

export { ROOM_GROUPS, roomGroupOf, type RoomGroup };

export type RoomAvailabilityRecord = {
  complex_id: string;
  rooms: number;
  free_count: number | null;
  /** Свободные этого типа в блоках со списком квартир — известная часть числа. */
  listed_free: number;
  available: boolean | null;
};

/** free: null — числа нет (есть блок по планировкам); known — известная часть (в блоках со списком). */
export type RoomStock = { group: RoomGroup; free: number | null; known: number };

/** free — сумма известных; partial — есть типы без числа; groups — только с наличием. */
export type ComplexStock = { groups: RoomStock[]; free: number; partial: boolean };

export const EMPTY_STOCK: ComplexStock = { groups: [], free: 0, partial: false };

/** Мокап: 0 — «нет», до 10 — янтарная пилюля, больше — зелёная. */
export const LOW_STOCK = 10;

/** Свободно по записи: число; null — без списка квартир, но «доступна»; без списка и нет — 0. */
export function recordFree(record: Pick<RoomAvailabilityRecord, "free_count" | "available">) {
  if (record.free_count !== null) return record.free_count;
  return record.available ? null : 0;
}

function stockOf(records: readonly RoomAvailabilityRecord[]): ComplexStock {
  const byGroup = new Map<RoomGroup, RoomStock>();
  for (const record of records) {
    const group = roomGroupOf(record.rooms);
    const was = byGroup.get(group) ?? { group, free: 0, known: 0 };
    // Валюты блоков складываются: в строке списка важно число квартир, не цена.
    const free = recordFree(record);
    byGroup.set(group, {
      group,
      free: was.free === null || free === null ? null : was.free + free,
      known: was.known + record.listed_free,
    });
  }
  const groups = ROOM_GROUPS.map((group) => byGroup.get(group)).filter(
    (item): item is RoomStock => item !== undefined && item.free !== 0,
  );
  return {
    groups,
    free: groups.reduce((sum, item) => sum + item.known, 0),
    partial: groups.some((item) => item.free === null),
  };
}

export function stockByComplex(
  records: readonly RoomAvailabilityRecord[],
): Map<string, ComplexStock> {
  const grouped = new Map<string, RoomAvailabilityRecord[]>();
  for (const record of records) {
    grouped.set(record.complex_id, [...(grouped.get(record.complex_id) ?? []), record]);
  }
  return new Map([...grouped].map(([id, items]) => [id, stockOf(items)]));
}

export type StockTone = "none" | "low" | "ok";

export function stockTone(stock: ComplexStock): StockTone {
  if (stock.free === 0 && !stock.partial) return "none";
  return stock.free <= LOW_STOCK && !stock.partial ? "low" : "ok";
}

/**
 * Пилюля остатков: «нет свободных», «по планировкам», «свободно N», «свободно N+»; на главной ещё
 * «без планировки N» — свободные есть, но ни одной не назначена планировка (в типах их нет).
 */
export type StockBadgeView = {
  text: "none" | "byLayouts" | "free" | "freePartial" | "unassigned";
  count: number;
  tone: StockTone;
};

export function stockBadgeView(stock: ComplexStock, unassigned = 0): StockBadgeView {
  if (stock.groups.length === 0) {
    return unassigned > 0
      ? { text: "unassigned", count: unassigned, tone: "low" }
      : { text: "none", count: 0, tone: "none" };
  }
  if (stock.free === 0 && stock.partial) return { text: "byLayouts", count: 0, tone: "ok" };
  return {
    text: stock.partial ? "freePartial" : "free",
    count: stock.free,
    tone: stockTone(stock),
  };
}

/** «14», у типа по планировкам — «18+» (известная часть) или «✓» (известного нет). */
export function roomFreeText(room: RoomStock): string {
  if (room.free !== null) return String(room.free);
  return room.known > 0 ? `${room.known}+` : "✓";
}
