"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LayoutDraft } from "@/lib/admin/complexes/layouts";
import type { ComplexMediaResult } from "@/lib/admin/complexes/types";
import { uploadComplexFile } from "@/lib/admin/complexes/upload";
import { UploadRefused } from "@/lib/admin/storageUpload";
import type { FormAction } from "@/lib/admin/developers/types";
import { processImage } from "@/lib/media";

type DrawingUpload = {
  complexId: string;
  /** null — без облака (служебный стенд): чертежи остаются в браузере. */
  attach: FormAction<ComplexMediaResult> | null;
  /** Опубликованный ЖК: чертёж сразу на сайте — загрузка только с отметкой правила 1.2 (И8). */
  published: boolean;
  /** После загрузки строка получает чертёж; отметка 1.2 снимается — она на одну загрузку (И8). */
  onUploaded: (key: string, drawing: Pick<LayoutDraft, "drawingId" | "drawingSrc">) => void;
};

/**
 * Чертёж строки: подготовка в браузере → бакет → строка media_assets; ответ — текст ошибки.
 * uploading — пока идёт загрузка, вкладку не сохраняют: новая строка получит id с сервера, и
 * ответ загрузки уже не найдёт её по ключу.
 */
export function useDrawingUpload({ complexId, attach, published, onUploaded }: DrawingUpload) {
  const t = useTranslations("admin");
  const [uploads, setUploads] = useState(0);
  const [rule12, setRule12] = useState(false);
  const prepareAndAttach = async (key: string, file: File): Promise<string | null> => {
    const result = await processImage(file, "drawing");
    if (!result.ok) return t(`media.issues.${result.issue.code}`, result.issue);
    try {
      const { id, src } = await uploadComplexFile({
        complexId,
        image: result.image,
        attach,
        rule12,
      });
      onUploaded(key, { drawingId: id, drawingSrc: src });
      setRule12(false);
      return null;
    } catch (error) {
      return error instanceof UploadRefused ? t(`developers.errors.${error.code}`) : t("media.uploadFailed");
    }
  };
  const upload = async (key: string, file: File | undefined): Promise<string | null> => {
    if (!file) return null;
    setUploads((count) => count + 1);
    try {
      return await prepareAndAttach(key, file);
    } finally {
      setUploads((count) => count - 1);
    }
  };
  return { upload, uploading: uploads > 0, rule12, setRule12, locked: published && !rule12 };
}
