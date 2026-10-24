import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CALC_HINT_SLUGS, calcHintsFrom, type CalcHints } from "@/lib/calc/hints";
import { type HintItem, hintItemsFrom } from "../hints/hints";

// Подсказки «?» калькулятора (шаг 2.8) сессией сотрудника: все — для «Справочников» (и
// выключенные), включённые — для «Расчёта для клиента». Ошибка — как у справочников: экран ошибки.

const COLUMNS = "slug, term, text, is_active";

type HintRow = { slug: string; term: unknown; text: unknown; is_active: boolean };

async function hintRows(supabase: SupabaseClient): Promise<HintRow[]> {
  const { data, error } = await supabase
    .from("hints")
    .select(COLUMNS)
    .in("slug", [...CALC_HINT_SLUGS]);
  if (error) throw new Error("hints-unavailable", { cause: error });
  return (data ?? []) as HintRow[];
}

export async function readHintItems(supabase: SupabaseClient): Promise<HintItem[]> {
  return hintItemsFrom(await hintRows(supabase));
}

/** Тексты для калькулятора кабинета: выключенные — без «?». */
export async function readCalcHints(supabase: SupabaseClient): Promise<CalcHints> {
  return calcHintsFrom((await hintRows(supabase)).filter((row) => row.is_active));
}
