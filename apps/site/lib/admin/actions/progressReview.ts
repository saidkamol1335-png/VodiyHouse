"use server";

import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import type { ReviewActionResult } from "@/lib/admin/progress/types";
import { requireActionViewer } from "@/lib/admin/session";
import { expireProgress } from "@/lib/cache";

// Проверка отчётов хода строительства (фаза 5, 5D, мокап CabReview): менеджер и руководитель публикуют
// отчёт только с отметкой правила 1.2 (её проверяет и база) или возвращают видеографу с причиной.

const fail = (error: ContentErrorCode): ReviewActionResult => ({ status: "error", error });

/** «Опубликовать на сайте»: раздел «Ход строительства» и страница видео квартиры обновляются сразу. */
export async function publishProgressReportAction(formData: FormData): Promise<ReviewActionResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  if (!id) return fail("invalid");
  const { data, error } = await guard.supabase.rpc("publish_progress_report", {
    p_id: id,
    p_checked: readText(formData, "rule12") === "on",
  });
  if (error) return fail(contentDbErrorCode(error));
  expireProgress(id, (data as { complex_id: string }).complex_id);
  return { status: "done" };
}

/** «Вернуть видеографу» с причиной: он исправит и отправит снова. */
export async function returnProgressReportAction(formData: FormData): Promise<ReviewActionResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const note = readText(formData, "note")?.trim() ?? "";
  if (!id) return fail("invalid");
  if (!note || note.length > 300) return fail("returnNote");
  const { error } = await guard.supabase.rpc("return_progress_report", { p_id: id, p_note: note });
  return error ? fail(contentDbErrorCode(error)) : { status: "done" };
}
