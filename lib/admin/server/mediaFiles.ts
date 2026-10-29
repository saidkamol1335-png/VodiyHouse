import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, PROGRESS_VIDEO_BUCKET, PROGRESS_VIDEO_PATH_PATTERN } from "@/lib/media";

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

/**
 * Файлы отчёта хода строительства (фаза 5), которые вернула база после отправки или удаления: фото —
 * в бакете media, видео (.mp4) — в progress-video. Удаляет сервер секретным ключом: у видеографа в
 * хранилище права удалять нет, а пути уже проверила функция отчёта (только файлы этого отчёта).
 */
export async function removeProgressFiles(admin: SupabaseClient, paths: unknown): Promise<void> {
  const list = (Array.isArray(paths) ? paths : []).filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
  const videos = list.filter((path) => PROGRESS_VIDEO_PATH_PATTERN.test(path));
  await removeMediaFiles(admin, list.filter((path) => !videos.includes(path)));
  if (videos.length === 0) return;
  try {
    const { error } = await admin.storage.from(PROGRESS_VIDEO_BUCKET).remove(videos);
    if (error) console.error("progress-video-remove-failed", { paths: videos, error: error.message });
  } catch (error) {
    console.error("progress-video-remove-failed", { paths: videos, error });
  }
}
