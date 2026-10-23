"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaPreview } from "@/components/MediaDrop";
import {
  DEFAULT_FOCUS,
  MEDIA_BUCKET,
  mediaPath,
  mediaPublicUrl,
  type FocusPoint,
  type ProcessedImage,
} from "@/lib/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { refuseUpload, UploadRefused } from "../storageUpload";
import type { ContentErrorCode } from "./errors";
import type { DeveloperMediaActions } from "./types";

// Логотип или фон застройщика во вкладке «Основное» (шаг 9.4). В облаке браузер кладёт файл
// в бакет сессией руководителя, сервер привязывает его к застройщику; без облака (служебный
// стенд) превью живёт только в браузере.

type DeveloperMediaKind = "logo" | "cover";

type UseDeveloperMediaParams = {
  developerId: string;
  kind: DeveloperMediaKind;
  initial: MediaPreview | null;
  /** null — без облака: только превью в браузере. */
  actions: DeveloperMediaActions | null;
  /** Отметка правила 1.2 — у опубликованного застройщика без неё база отказывает (И8). */
  rule12?: boolean;
};

const FOCUS_SAVE_DELAY_MS = 400;
const YEAR_SECONDS = "31536000";

function mediaForm(fields: Record<string, string | number>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, String(value));
  return form;
}

/**
 * Файл в бакет → строка media_assets. Отказ Storage или сервера (файл убран) — UploadRefused,
 * его текст показывает форма; сбой сети — обычная ошибка, MediaDrop скажет «проверьте связь».
 */
async function uploadToCloud(
  params: UseDeveloperMediaParams & { actions: DeveloperMediaActions },
  image: ProcessedImage,
) {
  const supabase = createSupabaseBrowserClient();
  const path = mediaPath({ type: "developer", id: params.developerId }, image.type);
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const uploaded = await bucket.upload(path, image.blob, {
    contentType: image.type,
    cacheControl: YEAR_SECONDS,
    upsert: false,
  });
  if (uploaded.error) await refuseUpload(supabase, uploaded.error);
  const result = await params.actions.attach(
    mediaForm({
      id: params.developerId,
      kind: params.kind,
      path,
      width: image.width,
      height: image.height,
      blur: image.blur,
      focusX: DEFAULT_FOCUS.x,
      focusY: DEFAULT_FOCUS.y,
      ...(params.rule12 ? { rule12: "on" } : {}),
    }),
  );
  if (result.status === "error") {
    await bucket.remove([path]);
    throw new UploadRefused(result.error);
  }
  return mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path);
}

export function useDeveloperMedia(params: UseDeveloperMediaParams) {
  const [preview, setPreview] = useState<MediaPreview | null>(params.initial);
  const [error, setError] = useState<ContentErrorCode | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    },
    [],
  );

  const showLocal = (blob: Blob | null) => {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = blob ? URL.createObjectURL(blob) : null;
    return localUrl.current;
  };

  /** false — отказ: текст в форме (`error`); сбой сети бросается дальше, в MediaDrop. */
  const upload = async (image: ProcessedImage): Promise<boolean> => {
    setError(null);
    const { actions } = params;
    try {
      const src = actions
        ? await uploadToCloud({ ...params, actions }, image)
        : showLocal(image.blob)!;
      setPreview({ src, width: image.width, height: image.height, focus: DEFAULT_FOCUS });
      return true;
    } catch (failure) {
      if (!(failure instanceof UploadRefused)) throw failure;
      setError(failure.code);
      return false;
    }
  };

  const remove = async () => {
    setError(null);
    if (params.actions) {
      const result = await params.actions.remove(
        mediaForm({ id: params.developerId, kind: params.kind }),
      );
      if (result.status === "error") return setError(result.error);
    }
    showLocal(null);
    setPreview(null);
  };

  const setFocus = (focus: FocusPoint) => {
    setPreview((current) => current && { ...current, focus });
    const { actions } = params;
    if (!actions) return;
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      void actions.setFocus(
        mediaForm({ id: params.developerId, kind: params.kind, focusX: focus.x, focusY: focus.y }),
      );
    }, FOCUS_SAVE_DELAY_MS);
  };

  return { preview, error, upload, remove: () => void remove(), setFocus };
}
