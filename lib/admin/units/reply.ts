// Ответы функций базы для действий «Квартир»: числа {created, changed, …} и квартира строки.

import { parseUnitRecord } from "@/lib/units";
import { unitsFailure } from "./errors";
import type { UnitRowResult } from "./types";

/** Число из ответа функции базы {complex_id, created, …}. */
export function replyCount(data: unknown, key: string): number {
  const value = (data as Record<string, unknown> | null)?.[key];
  return typeof value === "number" ? value : 0;
}

/**
 * Квартира из ответа add_unit / update_unit. Запись в базе уже есть: сбой разбора — «не получилось»
 * (экран перечитает список), а не исключение, которое браузер принял бы за «нет связи».
 */
export function unitReply(data: unknown): UnitRowResult {
  try {
    return { status: "done", unit: parseUnitRecord((data as { unit: unknown }).unit) };
  } catch {
    return unitsFailure("unknown");
  }
}
