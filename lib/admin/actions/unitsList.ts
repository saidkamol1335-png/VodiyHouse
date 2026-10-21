"use server";

import { requireActionViewer } from "@/lib/admin/session";
import { unitsDbFailure, unitsFailure } from "@/lib/admin/units/errors";
import { isUuid } from "@/lib/admin/units/parse";
import type { BlockUnitsInput, BlockUnitsResult } from "@/lib/admin/units/types";
import { parseUnitRecords } from "@/lib/units";

// Чтение списка квартир блока для вкладки «Квартиры» (12.4): страница его не несёт — после
// каждого тапа статуса она перерисовывается, а в блоке до 5000 строк («Решения 12.2»). Отдельный
// файл: действия здесь только читают, кэш сайта им сбрасывать нечего (lib/cache/cache.test.ts).

/**
 * block_unit_rows — одним значением jsonb: обычный select PostgREST молча обрезается на 1000
 * строках. Чужой или удалённый блок — пустой список (экран тогда перечитает страницу).
 */
export async function readBlockUnitsAction(input: BlockUnitsInput): Promise<BlockUnitsResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return unitsFailure(guard.code);
  if (!isUuid(input?.blockId)) return unitsFailure("notFound");

  const { data, error } = await guard.supabase.rpc("block_unit_rows", { p_block: input.blockId });
  if (error) return unitsDbFailure(error);
  try {
    return { status: "done", units: parseUnitRecords(data ?? []) };
  } catch {
    return unitsFailure("unknown");
  }
}
