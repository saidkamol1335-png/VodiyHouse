// Группы комнат — как чипы «Остатков по ЖК» мокапа: Ст · 1к · 2к · 3к · 4+. Общие для списка ЖК
// (остатки) и фильтра квартир блока.

export const ROOM_GROUPS = ["studio", "1", "2", "3", "4plus"] as const;
export type RoomGroup = (typeof ROOM_GROUPS)[number];

export function roomGroupOf(rooms: number): RoomGroup {
  if (rooms <= 0) return "studio";
  return rooms >= 4 ? "4plus" : (String(rooms) as RoomGroup);
}
