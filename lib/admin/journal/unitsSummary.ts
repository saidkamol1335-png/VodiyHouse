// Сводная запись журнала о квартирах (шаг 12.1): одно действие — одна запись, подробности — в
// changes.summary (private.write_units_summary). Разбор защитный: чужая или битая сводка — null,
// запись всё равно показывается со своими парами «было → стало».

import { isUnitStatus, type UnitStatus } from "@/lib/units";

export type UnitStatusGroup = { from: UnitStatus; to: UnitStatus; count: number; numbers: string };
/** layoutId null — сняли планировку; подпись у двух планировок может совпасть. */
export type UnitsLayoutGroup = {
  layoutId: string | null;
  label: string | null;
  count: number;
  numbers: string;
};

type Base = { count: number; numbers: string };

export type UnitsSummary =
  | (Base & { kind: "create"; unassigned: number })
  | (Base & {
      kind: "status";
      groups: UnitStatusGroup[];
      undo: boolean;
      /** Не тронуты: их за эти секунды поменял другой сотрудник / удалили. */
      skipped: number;
      missing: number;
    })
  | (Base & { kind: "price"; mode: "total" | "per_m2" | "none"; withoutLayout: number })
  | (Base & { kind: "finishing" })
  | (Base & { kind: "layouts"; assigned: UnitsLayoutGroup[] })
  | (Base & {
      kind: "delete" | "delete_list";
      statuses: Record<UnitStatus, number>;
      /** Номера брони и продаж полностью — до CSV фазы 3 это единственный след статусов. */
      reservedNumbers: string | null;
      soldNumbers: string | null;
    });

type Raw = Record<string, unknown>;
/** Omit по каждому варианту сводки, а не по их общему пересечению. */
type Details = UnitsSummary extends infer S
  ? S extends unknown
    ? Omit<S, keyof Base>
    : never
  : never;

const isRaw = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const num = (raw: Raw, key: string) => (typeof raw[key] === "number" ? (raw[key] as number) : 0);
const str = (raw: Raw, key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : null);

function statusGroups(value: unknown): UnitStatusGroup[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRaw).flatMap((group) =>
    isUnitStatus(group.from) && isUnitStatus(group.to)
      ? [
          {
            from: group.from,
            to: group.to,
            count: num(group, "count"),
            numbers: str(group, "numbers") ?? "",
          },
        ]
      : [],
  );
}

function layoutGroups(value: unknown): UnitsLayoutGroup[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRaw).map((group) => ({
    layoutId: str(group, "layout_id"),
    label: str(group, "label"),
    count: num(group, "count"),
    numbers: str(group, "numbers") ?? "",
  }));
}

function detailsOf(kind: unknown, raw: Raw): Details | null {
  switch (kind) {
    case "create":
      return { kind, unassigned: num(raw, "unassigned") };
    case "status":
      return {
        kind,
        groups: statusGroups(raw.groups),
        undo: raw.undo === true,
        skipped: num(raw, "skipped"),
        missing: num(raw, "missing"),
      };
    case "price": {
      const mode = raw.mode === "total" || raw.mode === "per_m2" ? raw.mode : "none";
      return { kind, mode, withoutLayout: num(raw, "without_layout") };
    }
    case "finishing":
      return { kind };
    case "layouts":
      return { kind, assigned: layoutGroups(raw.assigned) };
    case "delete":
    case "delete_list": {
      const statuses = isRaw(raw.statuses) ? raw.statuses : {};
      return {
        kind,
        statuses: {
          free: num(statuses, "free"),
          reserved: num(statuses, "reserved"),
          sold: num(statuses, "sold"),
        },
        reservedNumbers: str(raw, "reserved_numbers"),
        soldNumbers: str(raw, "sold_numbers"),
      };
    }
    default:
      return null;
  }
}

/** Сводка из changes записи; null — у записи её нет или форма незнакомая. */
export function parseUnitsSummary(changes: unknown): UnitsSummary | null {
  if (!isRaw(changes) || !isRaw(changes.summary)) return null;
  const raw = changes.summary;
  const details = detailsOf(raw.kind, raw);
  if (!details) return null;
  return {
    count: num(raw, "count"),
    numbers: str(raw, "numbers") ?? "",
    ...details,
  } as UnitsSummary;
}
