"use server";

import { cacheLife, cacheTag } from "next/cache";
import type { FlatCalcRecord } from "@vh/shared/calc/flatScreen";
import { CATALOG_TAG } from "@/lib/cache";
import { unitFrom, type BlockUnitRecord, type PickerUnit } from "@/lib/site/picker/records";
import { PICKER_REFRESH } from "@/lib/site/picker/refresh";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePreviewClient, isPreview } from "@/lib/supabase/preview";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { readLayoutCalc } from "./flatCalc";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * «Рассчитать платёж» у планировки: открытые данные сайта — без входа и без скидок (PLAN §3.13).
 * В предпросмотре — с токеном гранта кабинета (черновик база отдаёт только по нему).
 */
export async function readLayoutCalcAction(layoutId: string): Promise<FlatCalcRecord | null> {
  if (typeof layoutId !== "string") return null;
  const preview = await isPreview();
  return readLayoutCalc(layoutId, preview);
}

/**
 * Расчёт на странице видео квартиры (фаза 5): та же планировка, но без списка квартир — номера,
 * цены и id свободных квартир не уходят в браузер вовсе (по этажу из видео клиент нашёл бы свою).
 */
export async function readLayoutCalcWithoutUnitsAction(
  layoutId: string,
): Promise<FlatCalcRecord | null> {
  if (typeof layoutId !== "string") return null;
  const record = await readLayoutCalc(layoutId, false);
  return record ? { ...record, units: [] } : null;
}

/** Квартиры блока ролью посетителя — в кэше; правка квартир в кабинете сбрасывает CATALOG_TAG (revalidate). */
async function fetchBlockUnits(blockId: string): Promise<PickerUnit[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("block_units", { target_block: blockId });
  if (error) throw new Error("block-units-unavailable", { cause: error });
  return (data as BlockUnitRecord[]).map(unitFrom);
}

/** Предпросмотр: мимо кэша, с токеном гранта — черновик база отдаёт только по нему. */
async function fetchPreviewBlockUnits(blockId: string): Promise<PickerUnit[]> {
  const { data, error } = await (await createSupabasePreviewClient()).rpc("block_units", { target_block: blockId });
  if (error) throw new Error("block-units-preview-unavailable", { cause: error });
  return (data as BlockUnitRecord[]).map(unitFrom);
}

/**
 * «Выбрать квартиру» (фаза 4): квартиры блоков со статусами. Сайт читает только при сборке и из кэша
 * (PLAN §10, п. 4): статус квартиры в кабинете сбрасывает кэш через revalidate, раздел перечитывает
 * кэш раз в PICKER_REFRESH.usual, пока он на экране. block_units отдаёт цену только свободной и
 * только видимого ЖК.
 */
export async function readComplexUnitsAction(
  blockIds: string[],
): Promise<{ units: Record<string, PickerUnit[]>; refreshMs: number } | null> {
  if (!Array.isArray(blockIds) || blockIds.length === 0 || blockIds.length > 20) return null;
  if (!blockIds.every((id) => typeof id === "string" && UUID.test(id)) || !hasSupabaseEnv())
    return null;
  const preview = await isPreview();
  try {
    const lists = await Promise.all(
      blockIds.map((id) => (preview ? fetchPreviewBlockUnits(id.toLowerCase()) : fetchBlockUnits(id.toLowerCase()))),
    );
    return {
      units: Object.fromEntries(blockIds.map((id, index) => [id, lists[index]!])),
      refreshMs: PICKER_REFRESH.usual,
    };
  } catch (error) {
    console.error("[novostroyki/zhk] квартиры блоков недоступны", error);
    return null;
  }
}
