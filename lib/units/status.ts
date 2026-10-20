// Статусы квартиры — ровно три, как в базе (enum unit_status) и на сайте (PLAN §3.1).
// Без броней с клиентами и продаж: это наличие, а не шахматка.

export const UNIT_STATUSES = ["free", "reserved", "sold"] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[number];

export function isUnitStatus(value: unknown): value is UnitStatus {
  return typeof value === "string" && (UNIT_STATUSES as readonly string[]).includes(value);
}
