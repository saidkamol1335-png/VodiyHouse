import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CATALOG_TAG, DEVELOPERS_TAG, SHOWCASE_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { readDiscountSettings } from "@/lib/site/discounts";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { EMPTY_SHOWCASE, showcaseFrom, withoutDiscounts, type SiteShowcase, type SiteShowcaseRecord } from "./records";

// Витрина сайта (шаг 3.16б): site_showcase() ролью посетителя, в кэше страницы (договор lib/cache:
// SHOWCASE_TAG — правка в «Витрине» кабинета; CATALOG_TAG и DEVELOPERS_TAG — публикация ЖК и
// застройщиков меняет, что в витрине видно). Снятие по дате — /api/cron/showcase в ташкентскую
// полночь сбрасывает те же теги. Ошибка базы — исключение (не кэшируется), снаружи — пустая витрина:
// главная без подборок и предложений лучше, чем «временно недоступна» целиком.

async function fetchShowcase(): Promise<SiteShowcase> {
  "use cache";
  cacheTag(SHOWCASE_TAG, CATALOG_TAG, DEVELOPERS_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_showcase");
  if (error) throw new Error("site-showcase-unavailable", { cause: error });
  return showcaseFrom((data ?? {}) as SiteShowcaseRecord);
}

/**
 * Пустая витрина — без облака или если база не ответила (в лог). Скидки выключены (по умолчанию,
 * правки 15.11) — спецпредложений со скидкой нет нигде на сайте: все читают витрину отсюда.
 */
export async function readSiteShowcase(): Promise<SiteShowcase> {
  if (!hasSupabaseEnv()) return EMPTY_SHOWCASE;
  try {
    const [showcase, discounts] = await Promise.all([fetchShowcase(), readDiscountSettings()]);
    return discounts.enabled ? showcase : withoutDiscounts(showcase);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[vitrina] витрина недоступна", error);
    return EMPTY_SHOWCASE;
  }
}
