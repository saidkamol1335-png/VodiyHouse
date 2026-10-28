"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaPreview } from "@/components/MediaDrop";
import {
  DEFAULT_FOCUS,
  MEDIA_BUCKET,
  mediaPath,
  mediaPublicUrl,
  type FocusPoint,
  type MediaOwner,
  type ProcessedImage,
} from "@/lib/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ContentErrorCode } from "../developers/errors";
import { refuseUpload, UploadRefused } from "../storageUpload";

// Одно фото владельца — логотип или фон застройщика (шаг 9.4), обложка витрины (3.16а). В облаке
// браузер кладёт файл в бакет сессией руководителя, сервер привязывает его к владельцу; без облака
// (служебный стенд) превью живёт только в браузере.

export type OwnedMediaKind = "logo" | "cover";

export type OwnedMediaActionResult = { status: "done" } | { status: "error"; error: ContentErrorCode };
type OwnedMediaAction = (formData: FormData) => Promise<OwnedMediaActionResult>;

/** Поля действий: id (владелец), kind, path, width, height, blur, focusX, focusY — плюс extraFields. */
export type OwnedMediaActions = {
  attach: OwnedMediaAction;
  remove: OwnedMediaAction;
  setFocus: OwnedMediaAction;
};

export type UseOwnedMediaParams = {
  owner: MediaOwner;
  kind: OwnedMediaKind;
  initial: MediaPreview | null;
  /** null — без облака: только превью в браузере. */
  actions: OwnedMediaActions | null;
  /** Отметка правила 1.2 — у опубликованного владельца без неё база отказывает (И8). */
  rule12?: boolean;
  /** Что ещё сказать действию: владелец обложки витрины («owner: special»). */
  extraFields?: Record<string, string>;
};

const FOCUS_SAVE_DELAY_MS = 400;
const YEAR_SECONDS = "31536000";

function mediaForm(params: UseOwnedMediaParams, fields: Record<string, string | number>): FormData {
  const form = new FormData();
  const all = { id: params.owner.id, kind: params.kind, ...params.extraFields, ...fields };
  for (const [name, value] of Object.entries(all)) form.append(name, String(value));
  return form;
}

/**
 * Файл в бакет → строка media_assets. Отказ Storage или сервера (файл убран) — UploadRefused,
 * его текст показывает форма; сбой сети — обычная ошибка, MediaDrop скажет «проверьте связь».
 */
async function uploadToCloud(
  params: UseOwnedMediaParams & { actions: OwnedMediaActions },
  image: ProcessedImage,
) {
  const supabase = createSupabaseBrowserClient();
  const path = mediaPath(params.owner, image.type);
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const uploaded = await bucket.upload(path, image.blob, {
    contentType: image.type,
    cacheControl: YEAR_SECONDS,
    upsert: false,
  });
  if (uploaded.error) await refuseUpload(supabase, uploaded.error);
  const result = await params.actions.attach(
    mediaForm(params, {
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

export function useOwnedMedia(params: UseOwnedMediaParams) {
  const [preview, setPreview] = useState<MediaPreview | null>(params.initial);
  const [error, setError] = useState<ContentErrorCode | null>(null);
  const showLocal = useLocalUrl();
  const saveFocus = useFocusSave(params);

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
    const refused = await removeFromCloud(params);
    if (refused) return setError(refused);
    showLocal(null);
    setPreview(null);
  };

  const setFocus = (focus: FocusPoint) => {
    setPreview((current) => current && { ...current, focus });
    saveFocus(focus);
  };

  return { preview, error, upload, remove: () => void remove(), setFocus };
}

export type OwnedMedia = ReturnType<typeof useOwnedMedia>;

/** Удаление в облаке: код отказа или null (удалено; без облака — удалять нечего). */
async function removeFromCloud(params: UseOwnedMediaParams): Promise<ContentErrorCode | null> {
  if (!params.actions) return null;
  const result = await params.actions.remove(mediaForm(params, {}));
  return result.status === "error" ? result.error : null;
}

/** Превью без облака — blob: URL; прошлый отзывается, последний — при размонтировании. */
function useLocalUrl() {
  const localUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    },
    [],
  );
  return (blob: Blob | null) => {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = blob ? URL.createObjectURL(blob) : null;
    return localUrl.current;
  };
}

/** Точка фокуса сохраняется через паузу: перетаскивание — одна запись, а не десятки. */
function useFocusSave(params: UseOwnedMediaParams) {
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    },
    [],
  );
  return (focus: FocusPoint) => {
    const { actions } = params;
    if (!actions) return;
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      void actions.setFocus(mediaForm(params, { focusX: focus.x, focusY: focus.y }));
    }, FOCUS_SAVE_DELAY_MS);
  };
}
