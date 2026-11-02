"use server";

import { devOnly } from "../devOnly";
import { parseDetails } from "@/lib/admin/complexes/details";
import { parseDocuments } from "@/lib/admin/complexes/documents";
import type { DetailsResult, DocumentsResult, RemoveDeadlineChangeResult, VideosResult } from "@/lib/admin/complexes/types";
import { parseVideos } from "@/lib/admin/complexes/videos";

// «Видео», «Детали», «Документы» стенда /dev/zhk: настоящие проверки форм, без базы — DEMO не
// меняется, стенд показывает ответы действий (как actions.ts рядом).

const saved = () => ({ status: "saved", at: Date.now() }) as const;

export async function demoSaveDocumentsAction(formData: FormData): Promise<DocumentsResult> {
  devOnly();
  const parsed = parseDocuments(formData);
  return parsed.ok ? saved() : { status: "error", error: null, errors: parsed.errors, broken: [] };
}

export async function demoSaveVideosAction(formData: FormData): Promise<VideosResult> {
  devOnly();
  const parsed = parseVideos(formData);
  if (parsed.ok) return saved();
  return parsed.error
    ? { status: "error", error: parsed.error, errors: {}, broken: [] }
    : { status: "error", error: null, errors: parsed.errors, broken: [] };
}

/** «Убрать из истории» на стенде: DEMO не меняется — ответ как у настоящего действия. */
export async function demoRemoveDeadlineChangeAction(): Promise<RemoveDeadlineChangeResult> {
  devOnly();
  return { status: "done", at: Date.now() };
}

export async function demoSaveDetailsAction(formData: FormData): Promise<DetailsResult> {
  devOnly();
  const parsed = parseDetails(formData);
  return parsed.ok ? saved() : { status: "error", error: null, errors: parsed.errors, broken: [] };
}
