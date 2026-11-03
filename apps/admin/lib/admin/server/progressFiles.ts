import "server-only";
import {
  INCOMING_BUCKET,
  INCOMING_PATH_PATTERN,
  mediaPublicUrl,
  PROGRESS_PHOTO_PATH_PATTERN,
  PROGRESS_VIDEO_PATH_PATTERN,
  progressVideoPublicUrl,
} from "@/lib/media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Адреса файлов отчётов для кабинета (фаза E, п. 13): опубликованные — публичные ссылки media и
// progress-video; загрузки incoming приватные — подписывает сервер секретным ключом на час. Пути — только
// из строк, которые сотрудник прочитал своей сессией (RLS решил, что ему их видно).

const SIGNED_SECONDS = 60 * 60;

/** path → адрес; неизвестный путь или сбой подписи — без адреса (плитка без картинки, не ошибка экрана). */
export async function signProgressFiles(paths: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urls = new Map<string, string>();
  const incoming: string[] = [];
  for (const path of new Set(paths)) {
    if (!path) continue;
    if (PROGRESS_PHOTO_PATH_PATTERN.test(path)) urls.set(path, mediaPublicUrl(base, path));
    else if (PROGRESS_VIDEO_PATH_PATTERN.test(path)) urls.set(path, progressVideoPublicUrl(base, path));
    else if (INCOMING_PATH_PATTERN.test(path)) incoming.push(path);
  }
  if (incoming.length === 0) return urls;
  try {
    const { data, error } = await createSupabaseAdminClient()
      .storage.from(INCOMING_BUCKET)
      .createSignedUrls(incoming, SIGNED_SECONDS);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  } catch (error) {
    console.error("progress-sign-failed", { count: incoming.length, error });
  }
  return urls;
}
