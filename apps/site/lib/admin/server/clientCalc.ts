import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientCalcFrom, type ClientCalcRecord, type ClientCalcScreen } from "../calc/screen";
import { effectiveRate } from "../programs/types";
import { readRateSetting } from "./programs";

// «Расчёт для клиента» (шаг 2.5): данные экрана — client_calc_screen() сессией сотрудника
// (руководитель и менеджер). Сбой — исключение: app/admin/error.tsx покажет «Кабинет недоступен».

export async function readClientCalc(
  supabase: SupabaseClient,
  developerSlug: string | null,
): Promise<ClientCalcScreen> {
  const { data, error } = await supabase.rpc("client_calc_screen", { p_developer: developerSlug });
  if (error) throw new Error("client-calc-unavailable", { cause: error });
  const rate = effectiveRate(await readRateSetting(supabase));
  return clientCalcFrom(data as ClientCalcRecord, rate);
}
