"use server";

import { requireActionViewer } from "@/lib/admin/session";
import { unitsDbFailure, unitsFailure } from "@/lib/admin/units/errors";
import { isUuid, readFinishing, readPrice, readUnitIds } from "@/lib/admin/units/parse";
import { replyCount } from "@/lib/admin/units/reply";
import type {
  ChangedResult,
  DeleteUnitsResult,
  SetUnitsFinishingInput,
  SetUnitsPriceInput,
  SetUnitsPriceResult,
  UnitIdsInput,
} from "@/lib/admin/units/types";
import { complexIdFrom, expireComplex } from "@/lib/cache";

// Массовая панель руководителя (12.5, Н3): удалить выделенные, цена, отделка. Как и units.ts:
// первой строкой — руководитель, вход разбирается заново, инварианты держат функции базы.

const headGuard = () => requireActionViewer(["head"]);

/** «Удалить» выделенные; весь список — только «Удалить список блока». */
export async function deleteUnitsAction(input: UnitIdsInput): Promise<DeleteUnitsResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  const ids = readUnitIds(input?.unitIds);
  if (!isUuid(input?.blockId) || !ids) return unitsFailure("invalid");

  const { data, error } = await guard.supabase.rpc("delete_units", {
    p_block: input.blockId,
    p_unit_ids: ids,
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return { status: "done", deleted: replyCount(data, "deleted") };
}

/** Массовая цена (Н3): за м², целиком или «без цены»; брони и проданным — тоже (сайт не видит). */
export async function setUnitsPriceAction(input: SetUnitsPriceInput): Promise<SetUnitsPriceResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  const ids = readUnitIds(input?.unitIds);
  const price = readPrice(input?.mode, input?.value);
  if (!isUuid(input?.blockId) || !ids) return unitsFailure("invalid");
  if (!price) return unitsFailure("invalid", "price");

  const { data, error } = await guard.supabase.rpc("set_units_price", {
    p_block: input.blockId,
    p_unit_ids: ids,
    p_mode: price.mode,
    p_value: price.value,
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return {
    status: "done",
    changed: replyCount(data, "changed"),
    withoutLayout: replyCount(data, "without_layout"),
  };
}

/** Массовая отделка; null — «как в блоке». */
export async function setUnitsFinishingAction(
  input: SetUnitsFinishingInput,
): Promise<ChangedResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  const ids = readUnitIds(input?.unitIds);
  const finishing = readFinishing(input?.finishingId);
  if (!isUuid(input?.blockId) || !ids) return unitsFailure("invalid");
  if (finishing === undefined) return unitsFailure("invalid", "finishing_id");

  const { data, error } = await guard.supabase.rpc("set_units_finishing", {
    p_block: input.blockId,
    p_unit_ids: ids,
    p_finishing: finishing,
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return { status: "done", changed: replyCount(data, "changed") };
}
