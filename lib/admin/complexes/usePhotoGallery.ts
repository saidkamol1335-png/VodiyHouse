"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_FOCUS, processImage, type FocusPoint, type MediaIssue } from "@/lib/media";
import type { ContentErrorCode } from "../developers/errors";
import { movePhoto, PHOTO_LIMITS, type PhotoActions, type PhotoItem } from "./photos";
import type { ComplexRequirement } from "./readiness";
import type { ComplexMediaResult } from "./types";
import { UploadRefused, uploadComplexFile } from "./upload";

// Галерея ЖК в браузере (И6): загрузка пачкой — по одному файлу (память телефона), порядок,
// удаление и точка фокуса сохраняются сразу; отказ сервера — возвращаем как было.

const FOCUS_SAVE_DELAY_MS = 400;

/** Файл в работе: превью ещё нет — плитка «Готовлю…» или ошибка с причиной. */
export type PendingPhoto = {
  key: string;
  name: string;
  issue: MediaIssue | null;
  error: ContentErrorCode | null;
  failed: boolean;
};

export type GalleryError = { error: ContentErrorCode; broken: ComplexRequirement[] } | null;

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

export function usePhotoGallery({ complexId, initial, actions, rule12 }: Params) {
  const [photos, setPhotos] = useState<PhotoItem[]>([...initial]);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<GalleryError>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (focusTimer.current && clearTimeout(focusTimer.current)), []);

  const refused = (result: ComplexMediaResult) =>
    result.status === "error"
      ? setError({ error: result.error, broken: result.broken })
      : setError(null);

  const uploadOne = async (file: File, key: string) => {
    const mark = (patch: Partial<PendingPhoto>) =>
      setPending((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      );
    const prepared = await processImage(file, "photo");
    if (!prepared.ok) return mark({ issue: prepared.issue, failed: true });
    try {
      const image = prepared.image;
      const { id, src } = await uploadComplexFile({
        complexId,
        image,
        attach: actions?.attach ?? null,
        rule12,
      });
      setPhotos((current) => [
        ...current,
        { id, src, width: image.width, height: image.height, focus: DEFAULT_FOCUS },
      ]);
      setPending((current) => current.filter((item) => item.key !== key));
    } catch (failure) {
      mark({ failed: true, error: failure instanceof UploadRefused ? failure.code : "network" });
    }
  };

  /** Пачка файлов: место — до 30 фото; остальные сразу с ошибкой «галерея заполнена». */
  const upload = async (files: readonly File[]) => {
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
    for (const [index, file] of files.entries()) {
      if (index < room) await uploadOne(file, items[index]!.key);
    }
  };

  const reorder = async (next: PhotoItem[]) => {
    const before = photos;
    setPhotos(next);
    if (!actions) return;
    const result = await actions.reorder(
      form({ id: complexId, order: JSON.stringify(next.map((photo) => photo.id)) }),
    );
    refused(result);
    if (result.status === "error") setPhotos(before);
  };

  const remove = async (id: string) => {
    if (actions) {
      const result = await actions.remove(form({ id: complexId, photo: id }));
      refused(result);
      if (result.status === "error") return false;
    }
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    return true;
  };

  const setFocus = (id: string, focus: FocusPoint) => {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, focus } : photo)));
    if (!actions) return;
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      void actions.setFocus(form({ id: complexId, photo: id, focusX: focus.x, focusY: focus.y }));
    }, FOCUS_SAVE_DELAY_MS);
  };

  return {
    photos,
    pending,
    error,
    upload,
    remove,
    setFocus,
    move: (id: string, to: number) => reorder(movePhoto(photos, id, to)),
    dismiss: (key: string) => setPending((current) => current.filter((item) => item.key !== key)),
  };
}
