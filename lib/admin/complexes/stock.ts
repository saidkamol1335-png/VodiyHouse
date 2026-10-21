// Остатки по комнатам в строке списка ЖК — как «Остатки по ЖК» мокапа: «Ст 7 · 1к 10 · 4+ 3»
// и пилюля «свободно N». Данные — room_availability(): по числу комнат и валюте. Блок без списка
// квартир не знает числа (free_count = null) — тип показывается без числа (PLAN §3.1).

export const ROOM_GROUPS = ["studio", "1", "2", "3", "4plus"] as const;
export type RoomGroup = (typeof ROOM_GROUPS)[number];

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

export function roomGroupOf(rooms: number): RoomGroup {
  if (rooms <= 0) return "studio";
  return rooms >= 4 ? "4plus" : (String(rooms) as RoomGroup);
}

function stockOf(records: readonly RoomAvailabilityRecord[]): ComplexStock {
  const byGroup = new Map<RoomGroup, number | null>();
  for (const record of records) {
    const group = roomGroupOf(record.rooms);
    const known = byGroup.has(group) ? byGroup.get(group)! : 0;
    // Валюты блоков складываются: в строке списка важно число квартир, не цена.
    const free = record.free_count === null ? (record.available ? null : 0) : record.free_count;
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
