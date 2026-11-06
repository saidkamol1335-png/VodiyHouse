import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { FILTER_ARCHIVE_KEY, filterArchiveFrom } from "@vh/shared/filterArchive";
import { SITE_SETTINGS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Архив кнопок фильтра каталога (06.11.2026): public_settings ролью посетителя, в кэше как контакты;
// «В архив» / «Вернуть» в «Настройки → Фильтр сайта» сбрасывает SITE_SETTINGS_TAG.

async function fetchArchivedFilterIds(): Promise<string[]> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("days");
  const { data, error } = await createSupabasePublicClient()
    .from("public_settings")
    .select("value")
    .eq("key", FILTER_ARCHIVE_KEY)
    .maybeSingle();
  if (error) throw new Error("site-filter-archive-unavailable", { cause: error });
  return filterArchiveFrom(data?.value).items.map((item) => item.id);
}

/** id скрытых кнопок и блоков; нет облака или база не ответила — фильтр целиком, а не ошибка страницы. */
export async function readArchivedFilterIds(): Promise<string[]> {
  if (!hasSupabaseEnv()) return [];
  try {
    return await fetchArchivedFilterIds();
  } catch (error) {
    console.error("[site] архив кнопок фильтра недоступен", error);
    return [];
  }
}
