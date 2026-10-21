import { canBeComplexCover, type FocusPoint } from "@/lib/media";
import type { FormAction } from "../developers/types";
import { PUBLISH_RULES } from "./readiness";
import type { ComplexMediaResult } from "./types";

// Вкладка «Фото» (И6): галерея ЖК по порядку, первое фото — обложка (ТЗ 12). Сохраняется сразу,
// как логотип застройщика: загрузка, порядок, удаление и точка фокуса — без «Сохранить вкладку».

/** До 30 фото — как add_complex_photo (PLAN 3а: нагрузка «15 ЖК по 30 фото»). */
export const PHOTO_LIMITS = { max: 30, minForPublish: PUBLISH_RULES.minPhotos } as const;

export type PhotoItem = {
  id: string;
  src: string;
  width: number;
  height: number;
  focus: FocusPoint;
};

/** Действия вкладки; null — без облака (служебный стенд): всё остаётся в браузере. */
export type PhotoActions = {
  attach: FormAction<ComplexMediaResult>;
  reorder: FormAction<ComplexMediaResult>;
  remove: FormAction<ComplexMediaResult>;
  setFocus: FormAction<ComplexMediaResult>;
};

/** Обложкой встаёт только фото от 2400 px (PLAN 3а). */
export const canBeCover = (photo: PhotoItem) => canBeComplexCover(photo);

export function movePhoto(photos: readonly PhotoItem[], id: string, to: number): PhotoItem[] {
  const from = photos.findIndex((photo) => photo.id === id);
  if (from < 0 || to < 0 || to >= photos.length || from === to) return [...photos];
  const next = [...photos];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
