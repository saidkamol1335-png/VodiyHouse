import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  HOUSE_AD_DEFAULT,
  HOUSE_AD_KEY,
  houseAdSettingsFrom,
  type HouseAdSettings,
} from "@vh/shared/houseAd";
import { SITE_SETTINGS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Выключатель своей рекламы Vodiy House (06.11.2026): public_settings ролью посетителя, в кэше как
// контакты; выключатель в «Витрина → Реклама» сбрасывает SITE_SETTINGS_TAG.

async function fetchHouseAdSettings(): Promise<HouseAdSettings> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("days");
  const { data, error } = await createSupabasePublicClient()
    .from("public_settings")
    .select("value")
    .eq("key", HOUSE_AD_KEY)
    .maybeSingle();
  if (error) throw new Error("site-house-ad-unavailable", { cause: error });
  return houseAdSettingsFrom(data?.value);
}

/** Нет облака или база не ответила — как было до выключателя: своя реклама показывается. */
export async function readHouseAdSettings(): Promise<HouseAdSettings> {
  if (!hasSupabaseEnv()) return HOUSE_AD_DEFAULT;
  try {
    return await fetchHouseAdSettings();
  } catch (error) {
    console.error("[site] выключатель своей рекламы недоступен", error);
    return HOUSE_AD_DEFAULT;
  }
}
