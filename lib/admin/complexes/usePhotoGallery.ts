"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { FocusPoint } from "@/lib/media";
import { settle } from "@/lib/ui/settle";
import type { ContentErrorCode } from "../developers/errors";
import { movePhoto, restoreOrder, worsensCover, type PhotoActions, type PhotoItem } from "./photos";
import type { ComplexRequirement } from "./readiness";
import type { ComplexMediaResult } from "./types";
import { usePhotoUploads } from "./usePhotoUploads";

export type { PendingPhoto } from "./usePhotoUploads";

// Галерея ЖК в браузере (И6): загрузка пачкой — по одному файлу (память телефона), порядок,
// удаление и точка фокуса сохраняются сразу; отказ сервера или сбой сети — возвращаем как было
// и говорим почему.

const FOCUS_SAVE_DELAY_MS = 400;

/** notCover — перестановка поставила бы обложкой фото меньше 2400 px. */
export type GalleryError = {
  error: ContentErrorCode | "notCover";
  broken: ComplexRequirement[];
} | null;

const NETWORK: ComplexMediaResult = { status: "error", error: "network", broken: [] };

function form(fields: Record<string, string | number>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, String(value));
  return data;
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
    const data = form({
      id: complexId,
      photo: item.id,
      focusX: item.focus.x,
      focusY: item.focus.y,
    });
    void settle(() => actions.setFocus(data), NETWORK).then(report);
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
  const [error, setError] = useState<GalleryError>(null);
  const uploads = usePhotoUploads({ complexId, actions, rule12 }, photos.length, (photo) =>
    setPhotos((current) => [...current, photo]),
  );
  const edits = usePhotoEdits(params, { photos, setPhotos, setError, locked: uploads.uploading });
  return {
    photos,
    error,
    ...uploads,
    ...edits,
    /** Пачка файлов: прошлая ошибка галереи гаснет до начала загрузки. */
    upload: (files: readonly File[]) => {
      setError(null);
      return uploads.upload(files);
    },
  };
}

export type PhotoGallery = ReturnType<typeof usePhotoGallery>;

type GalleryState = {
  photos: PhotoItem[];
  setPhotos: Dispatch<SetStateAction<PhotoItem[]>>;
  setError: (error: GalleryError) => void;
  /** Идёт загрузка: порядок не меняем — база сверяет полный список фото. */
  locked: boolean;
};

/** Порядок, удаление, точка фокуса: сохраняются сразу, отказ — возвращаем как было. */
function usePhotoEdits(params: Params, { photos, setPhotos, setError, locked }: GalleryState) {
  const { complexId, actions } = params;
  const refused = (result: ComplexMediaResult) =>
    setError(result.status === "error" ? { error: result.error, broken: result.broken } : null);
  const queueFocus = useFocusSaver(params, refused);
  const move = async (id: string, to: number) => {
    if (locked) return;
    const next = movePhoto(photos, id, to);
    if (worsensCover(photos, next)) return setError({ error: "notCover", broken: [] });
    const beforeIds = photos.map((photo) => photo.id);
    setPhotos(next);
    if (!actions) return setError(null);
    const order = JSON.stringify(next.map((photo) => photo.id));
    const result = await settle(() => actions.reorder(form({ id: complexId, order })), NETWORK);
    refused(result);
    if (result.status === "error") setPhotos((current) => restoreOrder(current, beforeIds));
  };
  const remove = async (id: string) => {
    if (actions) {
      const result = await settle(
        () => actions.remove(form({ id: complexId, photo: id })),
        NETWORK,
      );
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
  return { move, remove, setFocus };
}
