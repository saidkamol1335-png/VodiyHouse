"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_FOCUS, processImage, type FocusPoint, type MediaIssue } from "@/lib/media";
import type { ContentErrorCode } from "../developers/errors";
import {
  movePhoto,
  PHOTO_LIMITS,
  restoreOrder,
  worsensCover,
  type PhotoActions,
  type PhotoItem,
} from "./photos";
import type { ComplexRequirement } from "./readiness";
import type { ComplexMediaResult } from "./types";
import { UploadRefused, uploadComplexFile } from "./upload";

// Галерея ЖК в браузере (И6): загрузка пачкой — по одному файлу (память телефона), порядок,
// удаление и точка фокуса сохраняются сразу; отказ сервера или сбой сети — возвращаем как было
// и говорим почему.

const FOCUS_SAVE_DELAY_MS = 400;

/** Файл в работе: превью ещё нет — плитка «Готовлю…» или ошибка с причиной. */
export type PendingPhoto = {
  key: string;
  name: string;
  issue: MediaIssue | null;
  error: ContentErrorCode | null;
  failed: boolean;
};

/** notCover — перестановка поставила бы обложкой фото меньше 2400 px. */
export type GalleryError =
  { error: ContentErrorCode | "notCover"; broken: ComplexRequirement[] } | null;

const NETWORK: ComplexMediaResult = { status: "error", error: "network", broken: [] };

function form(fields: Record<string, string | number>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, String(value));
  return data;
}

/** Действие сервера: обрыв связи и сбой 5xx — тот же ответ «нет связи», а не исключение. */
async function settle(run: () => Promise<ComplexMediaResult>): Promise<ComplexMediaResult> {
  try {
    return await run();
  } catch {
    return NETWORK;
  }
}

type Params = {
  complexId: string;
  initial: readonly PhotoItem[];
  actions: PhotoActions | null;
  rule12: boolean;
};

/**
 * Точка фокуса: сохранение откладывается, пока тянут точку. Точка другого фото и уход со вкладки
 * отправляют отложенное сразу, а не отменяют его.
 */
function useFocusSaver(params: Params, onResult: (result: ComplexMediaResult) => void) {
  const latest = useRef({ params, onResult });
  const queued = useRef<{ id: string; focus: FocusPoint } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latest.current = { params, onResult };
  });
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const item = queued.current;
    queued.current = null;
    const { params: current, onResult: report } = latest.current;
    if (!item || !current.actions) return;
    const { actions, complexId } = current;
    const data = form({ id: complexId, photo: item.id, focusX: item.focus.x, focusY: item.focus.y });
    void settle(() => actions.setFocus(data)).then(report);
  }, []);
  useEffect(() => flush, [flush]);
  return (id: string, focus: FocusPoint) => {
    if (queued.current && queued.current.id !== id) flush();
    queued.current = { id, focus };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, FOCUS_SAVE_DELAY_MS);
  };
}

export function usePhotoGallery(params: Params) {
  const { complexId, initial, actions, rule12 } = params;
  const [photos, setPhotos] = useState<PhotoItem[]>([...initial]);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<GalleryError>(null);
  const uploading = pending.some((item) => !item.failed);

  const refused = (result: ComplexMediaResult) =>
    result.status === "error"
      ? setError({ error: result.error, broken: result.broken })
      : setError(null);
  const queueFocus = useFocusSaver(params, refused);

  /** true — фото в галерее; false — плитка с причиной отказа. */
  const uploadOne = async (file: File, key: string): Promise<boolean> => {
    const mark = (patch: Partial<PendingPhoto>) =>
      setPending((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      );
    const prepared = await processImage(file, "photo");
    if (!prepared.ok) {
      mark({ issue: prepared.issue, failed: true });
      return false;
    }
    try {
      const image = prepared.image;
      const attach = actions?.attach ?? null;
      const { id, src } = await uploadComplexFile({ complexId, image, attach, rule12 });
      const photo = { id, src, width: image.width, height: image.height, focus: DEFAULT_FOCUS };
      setPhotos((current) => [...current, photo]);
      setPending((current) => current.filter((item) => item.key !== key));
      return true;
    } catch (failure) {
      mark({ failed: true, error: failure instanceof UploadRefused ? failure.code : "network" });
      return false;
    }
  };

  /**
   * Пачка файлов: место — до 30 фото; остальные сразу с ошибкой «галерея заполнена».
   * Ответ — сколько фото легло в галерею (отметка 1.2 снимается только после удачной загрузки).
   */
  const upload = async (files: readonly File[]): Promise<number> => {
    setError(null);
    const room = PHOTO_LIMITS.max - photos.length - pending.filter((item) => !item.failed).length;
    const items = files.map((file, index) => ({
      key: crypto.randomUUID(),
      name: file.name,
      issue: null,
      error: index < room ? null : ("galleryFull" as const),
      failed: index >= room,
    }));
    setPending((current) => [...current, ...items]);
    let uploaded = 0;
    for (const [index, file] of files.entries()) {
      if (index < room && (await uploadOne(file, items[index]!.key))) uploaded += 1;
    }
    return uploaded;
  };

  /** Пока идёт загрузка, порядок не меняем: база сверяет полный список фото. */
  const move = async (id: string, to: number) => {
    if (uploading) return;
    const next = movePhoto(photos, id, to);
    if (worsensCover(photos, next)) return setError({ error: "notCover", broken: [] });
    const beforeIds = photos.map((photo) => photo.id);
    setPhotos(next);
    if (!actions) return setError(null);
    const order = JSON.stringify(next.map((photo) => photo.id));
    const result = await settle(() => actions.reorder(form({ id: complexId, order })));
    refused(result);
    if (result.status === "error") setPhotos((current) => restoreOrder(current, beforeIds));
  };

  const remove = async (id: string) => {
    if (actions) {
      const result = await settle(() => actions.remove(form({ id: complexId, photo: id })));
      refused(result);
      if (result.status === "error") return false;
    }
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    return true;
  };

  const setFocus = (id: string, focus: FocusPoint) => {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, focus } : photo)));
    queueFocus(id, focus);
  };

  return {
    photos,
    pending,
    error,
    uploading,
    upload,
    remove,
    setFocus,
    move,
    dismiss: (key: string) => setPending((current) => current.filter((item) => item.key !== key)),
  };
}
