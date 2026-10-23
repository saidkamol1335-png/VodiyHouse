"use client";

import { useState } from "react";
import { DEFAULT_FOCUS, processImage, type MediaIssue } from "@/lib/media";
import type { ContentErrorCode } from "../developers/errors";
import { UploadRefused } from "../storageUpload";
import { PHOTO_LIMITS, type PhotoActions, type PhotoItem } from "./photos";
import { uploadComplexFile } from "./upload";

// Загрузка фото ЖК пачкой — по одному файлу (память телефона): плитки «Готовлю…» и отказы.

/** Файл в работе: превью ещё нет — плитка «Готовлю…» или ошибка с причиной. */
export type PendingPhoto = {
  key: string;
  name: string;
  issue: MediaIssue | null;
  error: ContentErrorCode | null;
  failed: boolean;
};

type UploadTarget = { complexId: string; actions: PhotoActions | null; rule12: boolean };

type UploadOutcome = { ok: true; photo: PhotoItem } | { ok: false; patch: Partial<PendingPhoto> };

/** Один файл: подготовка в браузере → бакет → строка media_assets; отказ — с причиной. */
async function uploadPhotoFile(file: File, target: UploadTarget): Promise<UploadOutcome> {
  const prepared = await processImage(file, "photo");
  if (!prepared.ok) return { ok: false, patch: { issue: prepared.issue, failed: true } };
  const image = prepared.image;
  try {
    const attach = target.actions?.attach ?? null;
    const { complexId, rule12 } = target;
    const { id, src } = await uploadComplexFile({ complexId, image, attach, rule12 });
    const photo = { id, src, width: image.width, height: image.height, focus: DEFAULT_FOCUS };
    return { ok: true, photo };
  } catch (failure) {
    const error = failure instanceof UploadRefused ? failure.code : "network";
    return { ok: false, patch: { failed: true, error } };
  }
}

/** Места — до 30 фото: лишние файлы сразу с ошибкой «галерея заполнена». */
function pendingItems(files: readonly File[], room: number): PendingPhoto[] {
  return files.map((file, index) => ({
    key: crypto.randomUUID(),
    name: file.name,
    issue: null,
    error: index < room ? null : "galleryFull",
    failed: index >= room,
  }));
}

/** Пачка файлов по одному; легшее в галерею фото уходит в onAdded. */
export function usePhotoUploads(
  target: UploadTarget,
  photoCount: number,
  onAdded: (photo: PhotoItem) => void,
) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const drop = (key: string) => setPending((current) => current.filter((item) => item.key !== key));
  /** true — фото в галерее; false — плитка с причиной отказа. */
  const uploadOne = async (file: File, key: string): Promise<boolean> => {
    const outcome = await uploadPhotoFile(file, target);
    if (outcome.ok) {
      onAdded(outcome.photo);
      drop(key);
      return true;
    }
    setPending((current) =>
      current.map((item) => (item.key === key ? { ...item, ...outcome.patch } : item)),
    );
    return false;
  };
  /** Ответ — сколько фото легло в галерею (отметка 1.2 снимается только после удачной загрузки). */
  const upload = async (files: readonly File[]): Promise<number> => {
    const room = PHOTO_LIMITS.max - photoCount - pending.filter((item) => !item.failed).length;
    const items = pendingItems(files, room);
    setPending((current) => [...current, ...items]);
    let uploaded = 0;
    for (const [index, file] of files.entries()) {
      if (index < room && (await uploadOne(file, items[index]!.key))) uploaded += 1;
    }
    return uploaded;
  };
  return { pending, uploading: pending.some((item) => !item.failed), upload, dismiss: drop };
}
