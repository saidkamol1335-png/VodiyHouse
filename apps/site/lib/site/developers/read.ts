import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CATALOG_TAG, DEVELOPERS_TAG, developerTag } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { SLUG } from "@/lib/site/complex/read";
import {
  developerFrom,
  developerPageFrom,
  type DeveloperPage,
  type DeveloperPageRecord,
  type DeveloperRecord,
  type DeveloperSummary,
} from "./records";

// Застройщики на сайте (шаг 3.15): site_developers() и site_developer(slug) ролью посетителя, в кэше
// страницы (договор lib/cache: список — DEVELOPERS_TAG, страница — ещё и developerTag). Счётчики
// «N новостроек на сайте», «Сдано · Строится» считает база по ЖК — поэтому ещё и CATALOG_TAG:
// публикация или снятие ЖК (expireComplex) обновляет их сразу, а не через час. Ошибка базы —
// исключение, а не пустой ответ в кэше на час (как у каталога и страницы ЖК).

async function fetchDevelopers(): Promise<DeveloperSummary[]> {
  "use cache";
  cacheTag(DEVELOPERS_TAG, CATALOG_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_developers");
  if (error) throw new Error("site-developers-unavailable", { cause: error });
  return ((data ?? []) as DeveloperRecord[]).map(developerFrom);
}

/** null — облака нет (разработка без ключей): страница показывает «скоро». */
export async function readSiteDevelopers(): Promise<DeveloperSummary[] | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    return await fetchDevelopers();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[zastroyshchiki] список застройщиков недоступен", error);
    throw error;
  }
}

async function fetchDeveloper(slug: string): Promise<DeveloperPage | null> {
  "use cache";
  cacheTag(DEVELOPERS_TAG, CATALOG_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_developer", { p_slug: slug });
  if (error) throw new Error("site-developer-unavailable", { cause: error });
  if (!data) return null;
  const page = developerPageFrom(data as DeveloperPageRecord);
  cacheTag(developerTag(page.id));
  return page;
}

export type DeveloperPageResult =
  | { kind: "page"; page: DeveloperPage }
  | { kind: "missing" }
  | { kind: "unavailable" };

/** missing — такого застройщика на сайте нет; unavailable — облака нет. Один запрос на метаданные и страницу. */
export const readSiteDeveloper = cache(async (slug: string): Promise<DeveloperPageResult> => {
  if (!hasSupabaseEnv()) return { kind: "unavailable" };
  if (!SLUG.test(slug)) return { kind: "missing" };
  try {
    const page = await fetchDeveloper(slug);
    return page ? { kind: "page", page } : { kind: "missing" };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[zastroyshchiki] страница застройщика недоступна", error);
    throw error;
  }
});

async function fetchSlugState(slug: string): Promise<"archived" | null> {
  "use cache";
  cacheTag(DEVELOPERS_TAG, CATALOG_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_developer_slug_state", {
    p_slug: slug,
  });
  if (error) throw new Error("site-developer-state-unavailable", { cause: error });
  return data === "archived" ? "archived" : null;
}

/** Застройщик в архиве — страница отвечает редиректом на список; удалённый или чужой адрес — 404. */
export async function developerSlugState(slug: string): Promise<"archived" | null> {
  if (!hasSupabaseEnv() || !SLUG.test(slug)) return null;
  try {
    return await fetchSlugState(slug);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[zastroyshchiki] проверка адреса застройщика не удалась", error);
    throw error;
  }
}
