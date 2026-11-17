import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { type FaqItem, faqItemsFrom, SITE_FAQ_KEY } from "@vh/shared/faq";
import { SITE_SETTINGS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Общие «Частые вопросы» Vodiy House (правки 15.11, п. 7 + 23): public_settings ролью посетителя, в кэше
// как контакты; «Настройки → Частые вопросы» кабинета сбрасывает SITE_SETTINGS_TAG.

async function fetchSiteFaq(): Promise<FaqItem[]> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("days");
  const { data, error } = await createSupabasePublicClient()
    .from("public_settings")
    .select("value")
    .eq("key", SITE_FAQ_KEY)
    .maybeSingle();
  if (error) throw new Error("site-faq-unavailable", { cause: error });
  return faqItemsFrom(data?.value);
}

/** Нет облака или база не ответила — общих вопросов нет: блок скрыт, страница работает. */
export async function readSiteFaq(): Promise<FaqItem[]> {
  if (!hasSupabaseEnv()) return [];
  try {
    return await fetchSiteFaq();
  } catch (error) {
    console.error("[site] общие частые вопросы недоступны", error);
    return [];
  }
}
