import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INCOMING_BUCKET,
  INCOMING_PATH_PATTERN,
  MEDIA_BUCKET,
  PROGRESS_PHOTO_PATH_PATTERN,
  PROGRESS_VIDEO_BUCKET,
  PROGRESS_VIDEO_PATH_PATTERN,
} from "@/lib/media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Уборка файлов в бакете media через Storage API (прямой delete в storage.objects запрещён).
 * Если Storage не ответил, файл останется, а на сайте его нет — строки media_assets уже нет.
 */
export async function removeMediaFiles(supabase: SupabaseClient, paths: unknown): Promise<void> {
  const list = (Array.isArray(paths) ? paths : [paths]).filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
  if (list.length === 0) return;
  // Сирота в бакете не видна на сайте; чистка — вместе с окончательным удалением ЖК (фаза 3).
  // storage-js отказ возвращает, а не бросает: пути — в лог сервера, чтобы найти сирот.
  try {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(list);
    if (error) console.error("media-remove-failed", { paths: list, error: error.message });
  } catch (error) {
    console.error("media-remove-failed", { paths: list, error });
  }
}

/**
 * Картинки планов этажей у блоков, которых не будет после «Сохранить вкладку» на «Блоках» (фаза 4):
 * строки уйдут каскадом с блоком, и путь потом не найти — собираем до сохранения, удаляем после.
 */
export async function floorPlanFilesOfGoneBlocks(
  supabase: SupabaseClient,
  complexId: string,
  keptBlockIds: readonly string[],
): Promise<string[]> {
  const { data, error } = await supabase
    .from("floor_plans")
    .select("block_id, image:media_assets!floor_plans_image_id_fkey(path)")
    .eq("complex_id", complexId);
  if (error) {
    console.error("floor-plan-files-unavailable", { complexId, error: error.message });
    return [];
  }
  const kept = new Set(keptBlockIds);
  return (data as unknown as { block_id: string; image: { path: string } | null }[])
    .filter((row) => !kept.has(row.block_id) && row.image)
    .map((row) => row.image!.path);
}

/** Куда идёт файл отчёта по пути: incoming — до публикации, media — фото, progress-video — видео. */
export function progressFileBucket(path: string): string | null {
  if (INCOMING_PATH_PATTERN.test(path)) return INCOMING_BUCKET;
  if (PROGRESS_PHOTO_PATH_PATTERN.test(path)) return MEDIA_BUCKET;
  if (PROGRESS_VIDEO_PATH_PATTERN.test(path)) return PROGRESS_VIDEO_BUCKET;
  return null;
}

/**
 * Файлы отчёта хода строительства, которые вернула база после сохранения, удаления, возврата или
 * публикации: бакет — по явному шаблону пути (incoming, фото media, видео progress-video), прочее — в
 * лог и мимо. Удаляет сервер секретным ключом: пути уже проверила функция отчёта.
 */
export async function removeProgressFiles(admin: SupabaseClient, paths: unknown): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const path of Array.isArray(paths) ? paths : []) {
    if (typeof path !== "string" || path.length === 0) continue;
    const bucket = progressFileBucket(path);
    if (!bucket) {
      console.error("progress-file-unknown", { path });
      continue;
    }
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, list] of byBucket) {
    try {
      const { error } = await admin.storage.from(bucket).remove(list);
      if (error) console.error("progress-file-remove-failed", { bucket, paths: list, error: error.message });
    } catch (error) {
      console.error("progress-file-remove-failed", { bucket, paths: list, error });
    }
  }
}

/** То же секретным ключом сервера — для действий мобилографа (его сессии удалять файлы нельзя). */
export async function removeProgressFilesAsServer(paths: unknown): Promise<void> {
  await removeProgressFiles(createSupabaseAdminClient(), paths);
}
