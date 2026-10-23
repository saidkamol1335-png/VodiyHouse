"use client";

import { MEDIA_BUCKET, mediaPath, mediaPublicUrl, type ProcessedImage } from "@/lib/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FormAction } from "../developers/types";
import { refuseUpload, UploadRefused } from "../storageUpload";
import type { ComplexMediaResult } from "./types";

// Фото и чертежи ЖК (И5, И6): браузер кладёт подготовленный файл в бакет сессией руководителя,
// сервер привязывает его к ЖК (media_assets). Без облака (служебный стенд) — превью в браузере.

const YEAR_SECONDS = "31536000";

type UploadParams = {
  complexId: string;
  image: ProcessedImage;
  /** null — без облака: только превью в браузере. */
  attach: FormAction<ComplexMediaResult> | null;
  /** Отметка правила 1.2 — у опубликованного ЖК без неё база отказывает. */
  rule12: boolean;
};

function form(fields: Record<string, string | number>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, String(value));
  return data;
}

/** id — строки media_assets (на стенде — временный), src — ссылка для превью. */
export async function uploadComplexFile({ complexId, image, attach, rule12 }: UploadParams) {
  if (!attach) return { id: crypto.randomUUID(), src: URL.createObjectURL(image.blob) };
  const supabase = createSupabaseBrowserClient();
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const path = mediaPath({ type: "complex", id: complexId }, image.type);
  const uploaded = await bucket.upload(path, image.blob, {
    contentType: image.type,
    cacheControl: YEAR_SECONDS,
    upsert: false,
  });
  if (uploaded.error) await refuseUpload(supabase, uploaded.error);
  const result = await attach(
    form({
      id: complexId,
      path,
      width: image.width,
      height: image.height,
      blur: image.blur,
      ...(rule12 ? { rule12: "on" } : {}),
    }),
  );
  if (result.status === "error") {
    await bucket.remove([path]);
    throw new UploadRefused(result.error);
  }
  return { id: result.id, src: mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path) };
}
