// Статусы квартиры — ровно три, как в базе (enum unit_status) и на сайте (PLAN §3.1).
// Без броней с клиентами и продаж: это наличие, а не шахматка.

export const UNIT_STATUSES = ["free", "reserved", "sold"] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[number];

export function isUnitStatus(value: unknown): value is UnitStatus {
  return typeof value === "string" && (UNIT_STATUSES as readonly string[]).includes(value);
}

/** «Отменить» 5 с: прежние статусы группами — ответ set_units_status, вход revert_units_status. */
export type UnitsUndo = Array<{ status: UnitStatus; ids: string[] }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null — не та форма (пришло из браузера или база ответила не так). */
export function parseUnitsUndo(value: unknown): UnitsUndo | null {
  if (!Array.isArray(value)) return null;
  const groups: UnitsUndo = [];
  for (const group of value) {
    if (typeof group !== "object" || group === null) return null;
    const { status, ids } = group as { status?: unknown; ids?: unknown };
    if (!isUnitStatus(status) || !Array.isArray(ids)) return null;
    if (!ids.every((id): id is string => typeof id === "string" && UUID.test(id))) return null;
    groups.push({ status, ids });
  }
  return groups;
}
