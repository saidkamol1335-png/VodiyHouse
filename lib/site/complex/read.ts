import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { CATALOG_TAG, complexTag, developerTag, DEVELOPERS_TAG, DICTIONARIES_TAG, PROGRAMS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickerFrom, type PickerRecord } from "@/lib/site/picker/records";
import { progressReportsFrom, type ProgressReportRecord } from "@/lib/site/progress/records";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComplexPage } from "./model";
import { complexPageFrom, type ComplexPageRecord } from "./records";

// Страница ЖК (шаг 3.5): site_complex(slug) ролью посетителя, в кэше страницы (PLAN 3а: страницы
// ЖК статичные, обновляются по тегу). Теги — по договору lib/cache: ЖК и его застройщик; «не найден»
// и другие ЖК застройщика — CATALOG_TAG (публикация нового адреса сбрасывает и его); программы —
// PROGRAMS_TAG, названия отделки, документов и тем — DICTIONARIES_TAG.

/**
 * «Выбрать квартиру» (фаза 4) и «Ход строительства» (фаза 5) — отдельными RPC в той же записи кэша.
 * Разделы необязательные: сбой одного не снимает страницу — она выходит без него.
 */
async function withPicker(client: SupabaseClient, page: ComplexPage): Promise<ComplexPage> {
  const [picker, progress] = await Promise.all([
    client.rpc("site_complex_picker", { p_complex: page.id }),
    client.rpc("site_complex_progress", { p_complex: page.id }),
  ]);
  if (picker.error) console.error("[novostroyki/zhk] «Выбрать квартиру» недоступен", picker.error);
  if (progress.error) console.error("[novostroyki/zhk] «Ход строительства» недоступен", progress.error);
  return {
    ...page,
    picker: picker.error ? null : pickerFrom(picker.data as PickerRecord | null),
    progress: progress.error ? [] : progressReportsFrom(progress.data as ProgressReportRecord[] | null),
  };
}

async function fetchComplexPage(slug: string): Promise<ComplexPage | null> {
  "use cache";
  cacheTag(CATALOG_TAG, DEVELOPERS_TAG, PROGRAMS_TAG, DICTIONARIES_TAG);
  cacheLife("hours");
  const client = createSupabasePublicClient();
  const { data, error } = await client.rpc("site_complex", { p_slug: slug });
  // Исключение не кэшируется: база вернётся — страница сразу снова на месте.
  if (error) throw new Error("site-complex-unavailable", { cause: error });
  if (!data) return null;
  const page = complexPageFrom(data as ComplexPageRecord);
  cacheTag(complexTag(page.id), developerTag(page.developer.id));
  return withPicker(client, page);
}

/**
 * Предпросмотр (шаг 3.6, draftMode): мимо кэша и сессией сотрудника — site_complex отдаёт черновик
 * только сотруднику. Кука предпросмотра одна черновик не открывает.
 */
async function fetchPreviewPage(slug: string): Promise<ComplexPage | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("site_complex", { p_slug: slug });
  if (error) throw new Error("site-complex-preview-unavailable", { cause: error });
  return data ? withPicker(supabase, complexPageFrom(data as ComplexPageRecord)) : null;
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
