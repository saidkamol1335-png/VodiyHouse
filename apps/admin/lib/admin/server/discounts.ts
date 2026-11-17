import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DISCOUNTS_KEY, discountSettingsFrom, type DiscountSettings } from "@vh/shared/discounts";

// «Скидки на сайте» («Витрина → Спецпредложения», правки 15.11) сессией руководителя.
export async function readDiscountSettings(supabase: SupabaseClient): Promise<DiscountSettings> {
  const { data, error } = await supabase.from("settings").select("value").eq("key", DISCOUNTS_KEY).maybeSingle();
  if (error) throw new Error("discounts-unavailable", { cause: error });
  return discountSettingsFrom(data?.value);
}
