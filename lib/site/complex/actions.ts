"use server";

import { draftMode } from "next/headers";
import type { FlatCalcRecord } from "@/lib/calc/flatScreen";
import { unitFrom, type BlockUnitRecord, type PickerUnit } from "@/lib/site/picker/records";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readLayoutCalc } from "./flatCalc";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * «Рассчитать платёж» у планировки: открытые данные сайта — без входа и без скидок (PLAN §3.13).
 * В предпросмотре — сессией руководителя (черновик база считает только ему).
 */
export async function readLayoutCalcAction(layoutId: string): Promise<FlatCalcRecord | null> {
  if (typeof layoutId !== "string") return null;
  const { isEnabled: preview } = await draftMode();
  return readLayoutCalc(layoutId, preview);
}

/**
 * «Выбрать квартиру» (фаза 4): квартиры блока со статусами — мимо кэша, раздел перечитывает их,
 * пока открыт план: смена статуса в кабинете видна за секунды. block_units отдаёт цену только
 * свободной и только видимого ЖК (в предпросмотре — сессией сотрудника).
 */
export async function readBlockUnitsAction(blockId: string): Promise<PickerUnit[] | null> {
  if (typeof blockId !== "string" || !UUID.test(blockId) || !hasSupabaseEnv()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("block_units", { target_block: blockId });
  if (error) {
    console.error("[novostroyki/zhk] квартиры блока недоступны", error);
    return null;
  }
  return (data as BlockUnitRecord[]).map(unitFrom);
}
