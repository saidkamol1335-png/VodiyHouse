import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, PROGRAMS_TAG } from "@/lib/cache";
import type { FlatCalcRecord } from "@/lib/calc/flatScreen";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// «Расчёт для этой квартиры» на странице ЖК (шаг 2.7 → 3.5): site_layout_calc(планировка) ролью
// посетителя, в кэше — свободные квартиры и цены сбрасывает CATALOG_TAG, программы и курс —
// PROGRAMS_TAG. Страница статичная: расчёт приходит по нажатию «Рассчитать платёж».

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchLayoutCalc(layoutId: string): Promise<FlatCalcRecord | null> {
  "use cache";
  cacheTag(CATALOG_TAG, PROGRAMS_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_layout_calc", {
    p_layout: layoutId,
  });
  if (error) throw new Error("site-layout-calc-unavailable", { cause: error });
  return (data as FlatCalcRecord | null) ?? null;
}

/** null — нет такой планировки на сайте, считать нечего, или база не ответила. */
export async function readLayoutCalc(layoutId: string): Promise<FlatCalcRecord | null> {
  if (!UUID.test(layoutId) || !hasSupabaseEnv()) return null;
  try {
    return await fetchLayoutCalc(layoutId.toLowerCase());
  } catch (error) {
    console.error("[novostroyki/zhk] расчёт планировки недоступен", error);
    return null;
  }
}
