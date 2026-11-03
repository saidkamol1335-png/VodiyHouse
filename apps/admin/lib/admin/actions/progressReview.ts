"use server";

import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { progressReturnedText, type ProgressNotice } from "@/lib/admin/progress/notify";
import type { ReviewActionResult } from "@/lib/admin/progress/types";
import { removeProgressFilesAsServer } from "@/lib/admin/server/mediaFiles";
import { editUrl, notifyAuthor } from "@/lib/admin/server/progressNotify";
import { publishProgressAsHead } from "@/lib/admin/server/progressPublish";
import { requireActionViewer } from "@/lib/admin/session";
import { expireProgress } from "@/lib/cache";

// Проверка отчётов хода строительства (фаза 5, 5D, мокап CabReview; фаза E, пп. 13, 36, 38): руководитель
// (PLAN §10, п. 6) публикует отчёт только с отметкой правила 1.2 — файлы копируются из incoming в
// публичные бакеты; возвращает автору с причиной; убирает отдельный кадр. Секретный ключ — после свежей
// проверки Auth (fresh).

const fail = (error: ContentErrorCode): ReviewActionResult => ({ status: "error", error });

/** Версия отчёта (updated_at) из ящика — как её отдал PostgREST. */
const VERSION = /^\d{4}-\d{2}-\d{2}[T ][\d:.]+([+-]\d{2}(:?\d{2})?|Z)$/;

/** «Опубликовать на сайте»: раздел «Ход строительства» и страница видео квартиры обновляются сразу. */
export async function publishProgressReportAction(formData: FormData): Promise<ReviewActionResult> {
  const guard = await requireActionViewer(["head"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const version = readText(formData, "version") ?? "";
  if (!id || !VERSION.test(version)) return fail("invalid");
  const outcome = await publishProgressAsHead(guard.supabase, {
    id,
    checked: readText(formData, "rule12") === "on",
    version,
    actorId: guard.viewer.id,
  });
  if (!outcome.ok) return fail(outcome.error);
  expireProgress(id, outcome.complexId);
  return { status: "done" };
}

/** «Вернуть мобилографу» с причиной: он исправит и отправит снова; ему — сообщение в Telegram (п. 36). */
export async function returnProgressReportAction(formData: FormData): Promise<ReviewActionResult> {
  const guard = await requireActionViewer(["head"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const note = readText(formData, "note")?.trim() ?? "";
  if (!id) return fail("invalid");
  if (!note || note.length > 300) return fail("returnNote");
  const { data, error } = await guard.supabase.rpc("return_progress_report", { p_id: id, p_note: note });
  if (error) return fail(contentDbErrorCode(error));
  const returned = data as { author_id: string | null; removed: string[]; notice: ProgressNotice };
  await removeProgressFilesAsServer(returned.removed);
  const text = progressReturnedText(returned.notice, note, editUrl(id));
  await notifyAuthor(returned.author_id, guard.viewer.id, text).catch(() => false);
  return { status: "done" };
}

/** «Убрать кадр» (п. 38): в отчёте на проверке остаётся не меньше 3 фото. */
export async function removeProgressPhotoAction(formData: FormData): Promise<ReviewActionResult> {
  const guard = await requireActionViewer(["head"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const photo = readUuid(formData, "photo");
  if (!photo) return fail("invalid");
  const { data, error } = await guard.supabase.rpc("remove_progress_photo", { p_photo: photo });
  if (error) return fail(contentDbErrorCode(error));
  await removeProgressFilesAsServer((data as { removed: string[] }).removed);
  return { status: "done" };
}
