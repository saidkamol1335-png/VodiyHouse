import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Адрес ЖК, которого на сайте больше нет (шаг 3.13, PLAN §3а): редирект на каталог, а не 404 (ссылки
// в рекламе и поиске ведут в каталог). В архиве — временный (ЖК могут восстановить, браузер и поиск
// не должны запомнить переход), удалён — постоянный. В кэше каталога: «В архив» и «Восстановить»
// сбрасывают CATALOG_TAG.

export type SlugState = "archived" | "deleted" | null;

async function fetchSlugState(slug: string): Promise<SlugState> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_slug_state", { p_slug: slug });
  if (error) throw new Error("site-slug-state-unavailable", { cause: error });
  return data === "archived" || data === "deleted" ? data : null;
}

/**
 * База не ответила — ошибка, а не «адреса нет»: иначе в кэш легла бы страница 404 вместо
 * редиректа (как readComplexPage — Next оставит прошлую версию или покажет error.tsx).
 */
export async function complexSlugState(slug: string): Promise<SlugState> {
  if (!hasSupabaseEnv()) return null;
  try {
    return await fetchSlugState(slug);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[site] проверка адреса ЖК не удалась", error);
    throw error;
  }
}
