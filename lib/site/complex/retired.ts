import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Адрес ЖК, которого на сайте больше нет (шаг 3.13, PLAN §3а): в архиве или удалён после него —
// страница отвечает 308 (постоянный) на каталог, а не 404 (ссылки в рекламе и поиске ведут в каталог). В кэше
// каталога: «В архив» и «Восстановить» сбрасывают CATALOG_TAG.

async function fetchRetired(slug: string): Promise<boolean> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_retired_slug", { p_slug: slug });
  if (error) throw new Error("site-retired-unavailable", { cause: error });
  return data === true;
}

/** База не ответила — «нет»: страница покажет 404, а не уведёт посетителя по ошибке. */
export async function isRetiredComplex(slug: string): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  try {
    return await fetchRetired(slug);
  } catch (error) {
    console.error("[site] проверка адреса ЖК не удалась", error);
    return false;
  }
}
