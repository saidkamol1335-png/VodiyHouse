import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FILTER_ARCHIVE_KEY,
  type FilterArchive,
  filterArchiveFrom,
} from "@vh/shared/filterArchive";
import { catalogFrom, type SiteCatalog, type SiteCatalogRecord } from "@/lib/site/catalog/records";

// «Настройки → Фильтр сайта» сессией сотрудника: архив кнопок (settings) и каталог сайта
// (site_catalog — тот же, что видит посетитель), чтобы показать кнопки фильтра как на сайте.

export type FilterArchiveRow =
  | { ok: true; archive: FilterArchive; /** null — строки ещё нет. */ updatedAt: string | null }
  | { ok: false };

/** Архив с версией строки — для записи с проверкой версии (действие «В архив» / «Вернуть»). */
export async function readFilterArchiveRow(supabase: SupabaseClient): Promise<FilterArchiveRow> {
  const { data, error } = await supabase
    .from("settings")
    .select("value, updated_at")
    .eq("key", FILTER_ARCHIVE_KEY)
    .maybeSingle();
  if (error) return { ok: false };
  return { ok: true, archive: filterArchiveFrom(data?.value), updatedAt: data?.updated_at ?? null };
}

export async function readFilterArchive(supabase: SupabaseClient): Promise<FilterArchive> {
  const row = await readFilterArchiveRow(supabase);
  if (!row.ok) throw new Error("filter-archive-unavailable");
  return row.archive;
}

/** Каталог не ответил — экран всё равно работает: комнаты, оплата и архив без списков из каталога. */
export async function readFilterCatalog(supabase: SupabaseClient): Promise<SiteCatalog | null> {
  const { data, error } = await supabase.rpc("site_catalog");
  if (error || !data) {
    console.error("[filter-archive] каталог недоступен", error);
    return null;
  }
  return catalogFrom(data as SiteCatalogRecord);
}
