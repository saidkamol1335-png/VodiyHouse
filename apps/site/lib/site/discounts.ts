import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DISCOUNTS_DEFAULT, DISCOUNTS_KEY, discountSettingsFrom, type DiscountSettings } from "@vh/shared/discounts";
import { SITE_SETTINGS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// «Показывать скидки» (правки 15.11, п. 4 + 21): public_settings ролью посетителя, в кэше как
// контакты; выключатель в «Витрина → Спецпредложения» сбрасывает SITE_SETTINGS_TAG.

async function fetchDiscountSettings(): Promise<DiscountSettings> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("days");
  const { data, error } = await createSupabasePublicClient()
    .from("public_settings")
    .select("value")
    .eq("key", DISCOUNTS_KEY)
    .maybeSingle();
  if (error) throw new Error("site-discounts-unavailable", { cause: error });
  return discountSettingsFrom(data?.value);
}

/** Нет облака или база не ответила — скидок на сайте нет (по умолчанию). */
export async function readDiscountSettings(): Promise<DiscountSettings> {
  if (!hasSupabaseEnv()) return DISCOUNTS_DEFAULT;
  try {
    return await fetchDiscountSettings();
  } catch (error) {
    console.error("[site] выключатель скидок недоступен", error);
    return DISCOUNTS_DEFAULT;
  }
}
