"use server";

import { requireActionViewer } from "@/lib/admin/session";
import { unitsDbFailure, unitsFailure } from "@/lib/admin/units/errors";
import { isUuid, readStatus, readUnitIds } from "@/lib/admin/units/parse";
import type {
  ChangedResult,
  RevertUnitsStatusInput,
  RevertUnitsStatusResult,
  SetLayoutAvailableInput,
  SetUnitsStatusInput,
  SetUnitsStatusResult,
} from "@/lib/admin/units/types";
import { complexIdFrom, expireComplex } from "@/lib/cache";
import { parseUnitsUndo } from "@/lib/units";

// Наличие (решение №7, Н7): статус квартир тапом и массово, «Отменить» 5 с, «доступна / нет в
// наличии» у планировки блока без списка. Руководитель и менеджер — менеджер меняет только это.

/** Число из ответа функции базы. */
function count(data: unknown, key: string): number {
  const value = (data as Record<string, unknown> | null)?.[key];
  return typeof value === "number" ? value : 0;
}

/** Статус тапом или массово; undo — прежние статусы группами для «Отменить» 5 с. */
export async function setUnitsStatusAction(
  input: SetUnitsStatusInput,
): Promise<SetUnitsStatusResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return unitsFailure(guard.code);
  const ids = readUnitIds(input?.unitIds);
  const status = readStatus(input?.status);
  if (!isUuid(input?.blockId) || !ids || !status) return unitsFailure("invalid");

  const { data, error } = await guard.supabase.rpc("set_units_status", {
    p_block: input.blockId,
    p_unit_ids: ids,
    p_status: status,
  });
  if (error) return unitsDbFailure(error);
  // Статусы уже записаны: сначала сайт, потом «Отменить» — без undo просто нечего отменять.
  expireComplex(complexIdFrom(data));
  const undo = parseUnitsUndo((data as { undo?: unknown } | null)?.undo) ?? [];
  return { status: "done", changed: count(data, "changed"), undo };
}

/** «Отменить»: квартиры, которые за эти секунды поменял другой сотрудник, не трогаются. */
export async function revertUnitsStatusAction(
  input: RevertUnitsStatusInput,
): Promise<RevertUnitsStatusResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return unitsFailure(guard.code);
  const status = readStatus(input?.status);
  const undo = parseUnitsUndo(input?.undo);
  if (!isUuid(input?.blockId) || !status || !undo) return unitsFailure("invalid");

  const { data, error } = await guard.supabase.rpc("revert_units_status", {
    p_block: input.blockId,
    p_status: status,
    p_undo: undo,
  });
  if (error) return unitsDbFailure(error);
  const skipped = (data as { skipped?: unknown } | null)?.skipped;
  expireComplex(complexIdFrom(data));
  return {
    status: "done",
    reverted: count(data, "reverted"),
    skipped: Array.isArray(skipped)
      ? skipped.filter((item): item is string => typeof item === "string")
      : [],
    missing: count(data, "missing"),
  };
}

/** «Доступна / нет в наличии» у планировки блока без списка квартир (Н7). */
export async function setLayoutAvailableAction(
  input: SetLayoutAvailableInput,
): Promise<ChangedResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return unitsFailure(guard.code);
  if (!isUuid(input?.layoutId) || typeof input.available !== "boolean")
    return unitsFailure("invalid");

  const { data, error } = await guard.supabase.rpc("set_layout_available", {
    p_layout: input.layoutId,
    p_available: input.available,
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return { status: "done", changed: count(data, "changed") };
}
