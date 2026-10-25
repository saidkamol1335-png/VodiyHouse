import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, DEVELOPERS_TAG, DICTIONARIES_TAG, PROGRAMS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { catalogFrom, type SiteCatalog, type SiteCatalogRecord } from "./records";

// Каталог сайта (шаг 3.3): site_catalog() ролью посетителя, в кэше страницы. Сбрасывают: ЖК, квартиры
// и фото — CATALOG_TAG, застройщики — DEVELOPERS_TAG, программы и курс — PROGRAMS_TAG, названия
// отделки и районов — DICTIONARIES_TAG; курс ЦБ по расписанию тег не трогает — отсюда «часы».

async function fetchSiteCatalog(): Promise<SiteCatalog> {
  "use cache";
  cacheTag(CATALOG_TAG, DEVELOPERS_TAG, PROGRAMS_TAG, DICTIONARIES_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_catalog");
  // Исключение не кэшируется: база вернётся — каталог сразу снова на месте.
  if (error) throw new Error("site-catalog-unavailable", { cause: error });
  return catalogFrom(data as SiteCatalogRecord);
}

/** null — облака нет или база не ответила: страница показывает «каталог скоро» с контактами VH. */
export async function readSiteCatalog(): Promise<SiteCatalog | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    return await fetchSiteCatalog();
  } catch (error) {
    console.error("[novostroyki] каталог недоступен", error);
    return null;
  }
}
