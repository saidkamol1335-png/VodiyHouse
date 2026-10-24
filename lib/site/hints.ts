import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DICTIONARIES_TAG } from "@/lib/cache";
import { CALC_HINT_SLUGS, calcHintsFrom, type CalcHints } from "@/lib/calc/hints";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Подсказки «?» калькулятора на сайте (шаг 2.8): справочник hints ролью посетителя (видны только
// включённые — RLS), в кэше страницы; «Сохранить» в «Справочниках» сбрасывает DICTIONARIES_TAG.

async function fetchCalcHints(): Promise<CalcHints> {
  "use cache";
  cacheTag(DICTIONARIES_TAG);
  cacheLife("days");
  const { data, error } = await createSupabasePublicClient()
    .from("hints")
    .select("slug, term, text")
    .in("slug", [...CALC_HINT_SLUGS]);
  if (error) throw new Error("hints-unavailable", { cause: error });
  return calcHintsFrom(data ?? []);
}

/** Нет облака или база не ответила — калькулятор без «?», а не ошибка страницы. */
export async function readSiteCalcHints(): Promise<CalcHints> {
  if (!hasSupabaseEnv()) return {};
  try {
    return await fetchCalcHints();
  } catch (error) {
    console.error("[kalkulyator] подсказки недоступны", error);
    return {};
  }
}
