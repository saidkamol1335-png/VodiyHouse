import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET } from "@/lib/media";

/**
 * Уборка файлов в бакете media через Storage API (прямой delete в storage.objects запрещён).
 * Если Storage не ответил, файл останется, а на сайте его нет — строки media_assets уже нет.
 */
export async function removeMediaFiles(supabase: SupabaseClient, paths: unknown): Promise<void> {
  const list = (Array.isArray(paths) ? paths : [paths]).filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
  if (list.length === 0) return;
  try {
    await supabase.storage.from(MEDIA_BUCKET).remove(list);
  } catch {
    // Сирота в бакете не видна на сайте; чистка — вместе с окончательным удалением ЖК (фаза 3).
  }
}
