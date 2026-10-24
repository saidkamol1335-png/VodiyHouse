import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, DICTIONARIES_TAG, PROGRAMS_TAG } from "@/lib/cache";
import { siteCalcFrom, type SiteCalcRecord, type SiteCalcScreen } from "@/lib/calc/siteScreen";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Данные /kalkulyator (шаг 2.6): site_calc_screen() ролью посетителя, в кэше страницы. Правка
// программ и курса в кабинете сбрасывает PROGRAMS_TAG, цены и публикация ЖК — CATALOG_TAG, банки
// в справочнике — DICTIONARIES_TAG; курс ЦБ по расписанию тег не трогает — отсюда «часы».

async function fetchSiteCalc(developerSlug: string | null): Promise<SiteCalcScreen> {
  "use cache";
  cacheTag(PROGRAMS_TAG, CATALOG_TAG, DICTIONARIES_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_calc_screen", {
    p_developer: developerSlug,
  });
  // Исключение не кэшируется: база вернётся — страница сразу снова с калькулятором.
  if (error) throw new Error("site-calc-unavailable", { cause: error });
  return siteCalcFrom(data as SiteCalcRecord);
}

/**
 * null — облака нет (разработка без ключей) или база не ответила: страница сайта не падает, а
 * показывает «калькулятор заработает…» с контактами Vodiy House; причина — в журнале сервера.
 */
export async function readSiteCalc(developerSlug: string | null): Promise<SiteCalcScreen | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    return await fetchSiteCalc(developerSlug);
  } catch (error) {
    console.error("[kalkulyator] данные калькулятора недоступны", error);
    return null;
  }
}
