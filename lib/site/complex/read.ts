import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { CATALOG_TAG, complexTag, developerTag, DEVELOPERS_TAG, DICTIONARIES_TAG, PROGRAMS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ComplexPage } from "./model";
import { complexPageFrom, type ComplexPageRecord } from "./records";

// Страница ЖК (шаг 3.5): site_complex(slug) ролью посетителя, в кэше страницы (PLAN 3а: страницы
// ЖК статичные, обновляются по тегу). Теги — по договору lib/cache: ЖК и его застройщик; «не найден»
// и другие ЖК застройщика — CATALOG_TAG (публикация нового адреса сбрасывает и его); программы —
// PROGRAMS_TAG, названия отделки, документов и тем — DICTIONARIES_TAG.

async function fetchComplexPage(slug: string): Promise<ComplexPage | null> {
  "use cache";
  cacheTag(CATALOG_TAG, DEVELOPERS_TAG, PROGRAMS_TAG, DICTIONARIES_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_complex", { p_slug: slug });
  // Исключение не кэшируется: база вернётся — страница сразу снова на месте.
  if (error) throw new Error("site-complex-unavailable", { cause: error });
  if (!data) return null;
  const page = complexPageFrom(data as ComplexPageRecord);
  cacheTag(complexTag(page.id), developerTag(page.developer.id));
  return page;
}

/**
 * Предпросмотр (шаг 3.6, draftMode): мимо кэша и сессией сотрудника — site_complex отдаёт черновик
 * только сотруднику. Кука предпросмотра одна черновик не открывает.
 */
async function fetchPreviewPage(slug: string): Promise<ComplexPage | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("site_complex", { p_slug: slug });
  if (error) throw new Error("site-complex-preview-unavailable", { cause: error });
  return data ? complexPageFrom(data as ComplexPageRecord) : null;
}

export type ComplexPageResult = { kind: "page"; page: ComplexPage } | { kind: "missing" } | { kind: "unavailable" };

// Адрес ЖК — как у slug в базе: выдуманный адрес не зовёт базу и не ложится в кэш.
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * missing — такого ЖК на сайте нет (404); unavailable — облака нет (разработка без ключей).
 * Ошибка базы — исключение: перерисовка в кэше не заменит страницу заглушкой с ответом 200,
 * Next оставит прежнюю версию, а первый показ — error.tsx раздела. React cache — один запрос на
 * метаданные и страницу (в предпросмотре чтение идёт мимо 'use cache').
 */
export const readComplexPage = cache(async (slug: string): Promise<ComplexPageResult> => {
  if (!hasSupabaseEnv()) return { kind: "unavailable" };
  if (!SLUG.test(slug)) return { kind: "missing" };
  try {
    const { isEnabled: preview } = await draftMode();
    const page = preview ? await fetchPreviewPage(slug) : await fetchComplexPage(slug);
    return page ? { kind: "page", page } : { kind: "missing" };
  } catch (error) {
    // Служебные исключения Next (пререндер, редирект) — дальше без записи в лог.
    unstable_rethrow(error);
    console.error("[novostroyki/zhk] страница ЖК недоступна", error);
    throw error;
  }
});
