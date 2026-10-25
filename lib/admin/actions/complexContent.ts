"use server";

import { parseDetails } from "@/lib/admin/complexes/details";
import { parseDocuments } from "@/lib/admin/complexes/documents";
import type { DetailsResult, DocumentsResult, SaveContentResult, VideosResult } from "@/lib/admin/complexes/types";
import { parseVideos } from "@/lib/admin/complexes/videos";
import type { DbErrorLike } from "@/lib/admin/authErrors";
import { readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { requireActionViewer } from "@/lib/admin/session";
import { expireComplex } from "@/lib/cache";

// Вкладки «Видео», «Документы», «Детали» (шаг 3.5). Как у остальных вкладок ЖК: первой строкой —
// руководитель (PLAN §3.11), права ещё раз проверяют функции базы; вкладка сохраняется целиком
// одним вызовом, после — сброс кэша страницы ЖК на сайте.

const headGuard = () => requireActionViewer(["head"]);

const failed = <E>(error: ContentErrorCode | null, errors: E): SaveContentResult<E> => ({ status: "error", error, errors, broken: [] });

/** Ответ базы → ответ вкладки. */
const answer = <E>(error: DbErrorLike | null): SaveContentResult<E> =>
  error ? failed(contentDbErrorCode(error), {} as E) : { status: "saved", at: Date.now() };

/** «Сохранить вкладку» на «Документах»: проверенные документы с датами. */
export async function saveComplexDocumentsAction(formData: FormData): Promise<DocumentsResult> {
  const guard = await headGuard();
  if (!guard.ok) return failed(guard.code, {});
  const parsed = parseDocuments(formData);
  if (!parsed.ok) return failed(null, parsed.errors);
  const id = readUuid(formData);
  if (!id) return failed("notFound", {});
  const { error } = await guard.supabase.rpc("save_complex_documents", { p_complex: id, p_documents: parsed.payload });
  if (!error) expireComplex(id);
  return answer(error);
}

/** «Сохранить вкладку» на «Видео»: ролики YouTube по порядку. */
export async function saveComplexVideosAction(formData: FormData): Promise<VideosResult> {
  const guard = await headGuard();
  if (!guard.ok) return failed(guard.code, {});
  const parsed = parseVideos(formData);
  if (!parsed.ok) return parsed.error ? failed(parsed.error, {}) : failed(null, parsed.errors);
  const id = readUuid(formData);
  if (!id) return failed("notFound", {});
  const { error } = await guard.supabase.rpc("save_complex_videos", { p_complex: id, p_videos: parsed.payload });
  if (!error) expireComplex(id);
  return answer(error);
}

/** «Сохранить вкладку» на «Деталях»: тексты тем с фото из галереи. */
export async function saveComplexDetailsAction(formData: FormData): Promise<DetailsResult> {
  const guard = await headGuard();
  if (!guard.ok) return failed(guard.code, {});
  const parsed = parseDetails(formData);
  if (!parsed.ok) return failed(null, parsed.errors);
  const id = readUuid(formData);
  if (!id) return failed("notFound", {});
  const { error } = await guard.supabase.rpc("save_complex_details", { p_complex: id, p_details: parsed.payload });
  if (!error) expireComplex(id);
  return answer(error);
}
