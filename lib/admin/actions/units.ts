"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActionViewer } from "@/lib/admin/session";
import { unitsDbFailure, unitsFailure } from "@/lib/admin/units/errors";
import {
  blockNameConfirmed,
  isUuid,
  readLayout,
  readPlan,
  readRisers,
  readUnitPatch,
} from "@/lib/admin/units/parse";
import { replyCount, unitReply } from "@/lib/admin/units/reply";
import type {
  AddUnitInput,
  CreateBlockUnitsInput,
  CreateBlockUnitsResult,
  DeleteBlockUnitsInput,
  DeleteUnitsResult,
  SaveRisersInput,
  SaveRisersResult,
  UnitRowResult,
  UpdateUnitInput,
} from "@/lib/admin/units/types";
import { complexIdFrom, expireComplex } from "@/lib/cache";
import {
  applyRisers,
  generateUnits,
  isUnitNumber,
  normalizeUnitNumber,
  parseUnitRecords,
  planFromUnits,
  riserEdits,
  toUnitInsertRows,
  toUnitLayoutItems,
} from "@/lib/units";

// «Квартиры» руководителя (шаг 12, Н4–Н6): генератор, правка строки, «+ Квартира», «Удалить
// список блока», стояки; массовые действия панели — unitsMass.ts. Каждое действие — открытый POST: первой строкой проверяет
// руководителя, вход разбирается заново (lib/admin/units/parse), права и инварианты ещё раз
// держат функции базы. Ответ функции называет ЖК — по нему сбрасывается кэш сайта.

const headGuard = () => requireActionViewer(["head"]);

/** Блок для действия; null — нет (или ошибка базы: её отдаёт error). */
async function readBlock(supabase: SupabaseClient, blockId: string) {
  return supabase.from("blocks").select("id, name, floors_total").eq("id", blockId).maybeSingle();
}

/** Генератор (Н6): план и стояки → строки lib/units → один вызов базы; этажность — блока. */
export async function createBlockUnitsAction(
  input: CreateBlockUnitsInput,
): Promise<CreateBlockUnitsResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  if (!isUuid(input?.blockId)) return unitsFailure("notFound");
  const plan = readPlan(input.plan);
  const risers = plan ? readRisers(input.risers, plan) : null;
  if (!plan || !risers) return unitsFailure("invalid");
  const block = await readBlock(guard.supabase, input.blockId);
  if (block.error) return unitsDbFailure(block.error);
  if (!block.data) return unitsFailure("notFound");
  if (block.data.floors_total !== plan.floors) return unitsFailure("invalid", "floors_total");

  const { data, error } = await guard.supabase.rpc("create_block_units", {
    p_block: block.data.id,
    p_units: toUnitInsertRows(applyRisers(generateUnits(plan), risers)),
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return {
    status: "done",
    created: replyCount(data, "created"),
    unassigned: replyCount(data, "unassigned"),
  };
}

/** «+ Квартира» (Н4): свободная, без цены; номер — без пробелов и заглавными («12a» → «12A»). */
export async function addUnitAction(input: AddUnitInput): Promise<UnitRowResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  if (!isUuid(input?.blockId)) return unitsFailure("notFound");
  const number = typeof input.number === "string" ? normalizeUnitNumber(input.number) : "";
  if (!isUnitNumber(number)) return unitsFailure("invalid", "number");
  const layout = readLayout(input.layoutId);
  if (layout === undefined) return unitsFailure("invalid", "layout_id");
  const slot = [input.entrance, input.floor, input.position];
  if (!slot.every((value) => Number.isInteger(value))) return unitsFailure("invalid", "slot");

  const { data, error } = await guard.supabase.rpc("add_unit", {
    p_block: input.blockId,
    p_entrance: input.entrance,
    p_floor: input.floor,
    p_position: input.position,
    p_number: number,
    p_layout: layout,
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return unitReply(data);
}

/** Правка строки (Н4): только переданные поля — номер, планировка, цена, отделка. */
export async function updateUnitAction(input: UpdateUnitInput): Promise<UnitRowResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  if (!isUuid(input?.blockId) || !isUuid(input.unitId)) return unitsFailure("notFound");
  const patch = readUnitPatch(input.patch);
  if (!patch) return unitsFailure("invalid");

  const { data, error } = await guard.supabase.rpc("update_unit", {
    p_block: input.blockId,
    p_unit: input.unitId,
    p_patch: patch,
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return unitReply(data);
}

/** «Удалить список блока» (Н4): название вводят как угодно («a», «А») — сверяем мягко. */
export async function deleteBlockUnitsAction(
  input: DeleteBlockUnitsInput,
): Promise<DeleteUnitsResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  if (!isUuid(input?.blockId)) return unitsFailure("notFound");
  const block = await readBlock(guard.supabase, input.blockId);
  if (block.error) return unitsDbFailure(block.error);
  if (!block.data) return unitsFailure("notFound");
  if (typeof input.confirm !== "string" || !blockNameConfirmed(input.confirm, block.data.name))
    return unitsFailure("confirmName");

  const { data, error } = await guard.supabase.rpc("delete_block_units", {
    p_block: block.data.id,
    p_confirm_name: block.data.name,
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return { status: "done", deleted: replyCount(data, "deleted") };
}

/**
 * Стояки готового блока (Н5): квартиры — из базы, что поменять — riserEdits по снимку панели:
 * меняется только то, что руководитель поменял в стояках; квартиры, которые поправили после
 * снимка, не трогаются (их номера — в skipped); стояк без планировки её снимает.
 */
export async function saveRisersAction(input: SaveRisersInput): Promise<SaveRisersResult> {
  const guard = await headGuard();
  if (!guard.ok) return unitsFailure(guard.code);
  if (!isUuid(input?.blockId)) return unitsFailure("notFound");
  const [block, rows] = await Promise.all([
    readBlock(guard.supabase, input.blockId),
    guard.supabase.rpc("block_unit_rows", { p_block: input.blockId }),
  ]);
  if (block.error || rows.error) return unitsDbFailure((block.error ?? rows.error)!);
  if (!block.data) return unitsFailure("notFound");
  const units = parseUnitRecords(rows.data ?? []);
  const plan = planFromUnits(units, block.data.floors_total);
  const base = readRisers(input.base, plan);
  const risers = readRisers(input.risers, plan);
  if (!base || !risers) return unitsFailure("invalid");
  const { changes, skipped } = riserEdits(units, base, risers);
  const skippedNumbers = skipped.map((unit) => unit.number);
  if (changes.length === 0) return { status: "done", changed: 0, skipped: skippedNumbers };

  const { data, error } = await guard.supabase.rpc("set_units_layouts", {
    p_block: input.blockId,
    p_items: toUnitLayoutItems(changes),
  });
  if (error) return unitsDbFailure(error);
  expireComplex(complexIdFrom(data));
  return { status: "done", changed: replyCount(data, "changed"), skipped: skippedNumbers };
}
