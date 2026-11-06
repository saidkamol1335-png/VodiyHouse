import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HOUSE_AD_KEY, houseAdSettingsFrom, type HouseAdSettings } from "@vh/shared/houseAd";

// Выключатель своей рекламы Vodiy House («Витрина → Реклама») сессией руководителя.
export async function readHouseAdSettings(supabase: SupabaseClient): Promise<HouseAdSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", HOUSE_AD_KEY)
    .maybeSingle();
  if (error) throw new Error("house-ad-unavailable", { cause: error });
  return houseAdSettingsFrom(data?.value);
}
