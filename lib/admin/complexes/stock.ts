// Остатки по комнатам в строке списка ЖК — как «Остатки по ЖК» мокапа: «Ст 7 · 1к 10 · 4+ 3»
// и пилюля «свободно N». Данные — room_availability(): по числу комнат и валюте. Блок без списка
// квартир не знает числа (free_count = null) — тип показывается без числа (PLAN §3.1).

import { ROOM_GROUPS, roomGroupOf, type RoomGroup } from "@/lib/units/rooms";

export { ROOM_GROUPS, roomGroupOf, type RoomGroup };

export type RoomAvailabilityRecord = {
  complex_id: string;
  rooms: number;
  free_count: number | null;
  available: boolean | null;
};

/** free: null — число неизвестно (наличие по флагу «доступна» у планировок). */
export type RoomStock = { group: RoomGroup; free: number | null };

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
  const byGroup = new Map<RoomGroup, number | null>();
  for (const record of records) {
    const group = roomGroupOf(record.rooms);
    const known = byGroup.has(group) ? byGroup.get(group)! : 0;
    // Валюты блоков складываются: в строке списка важно число квартир, не цена.
    const free = recordFree(record);
    byGroup.set(group, known === null || free === null ? null : known + free);
  }
  const groups = ROOM_GROUPS.filter((group) => byGroup.has(group) && byGroup.get(group) !== 0).map(
    (group) => ({ group, free: byGroup.get(group)! }),
  );
  return {
    groups,
    free: groups.reduce((sum, item) => sum + (item.free ?? 0), 0),
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

/** Пилюля остатков: «нет свободных», «по планировкам», «свободно N» или «свободно N+». */
export type StockBadgeView = {
  text: "none" | "byLayouts" | "free" | "freePartial";
  count: number;
  tone: StockTone;
};

export function stockBadgeView(stock: ComplexStock): StockBadgeView {
  if (stock.groups.length === 0) return { text: "none", count: 0, tone: "none" };
  if (stock.free === 0 && stock.partial) return { text: "byLayouts", count: 0, tone: "ok" };
  return {
    text: stock.partial ? "freePartial" : "free",
    count: stock.free,
    tone: stockTone(stock),
  };
}
