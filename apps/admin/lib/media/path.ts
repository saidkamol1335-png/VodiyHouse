import type { MediaKind } from "./rules";

// Где лежит файл в бакете media. Тот же формат проверяет политика Storage
// (private.is_media_path) — tests/db/storage.test.ts сверяет их.

export const MEDIA_BUCKET = "media";

/** Владелец файла: ЖК, застройщик или запись витрины (3.16а) — у каждого своя папка. */
export type MediaOwnerType = "complex" | "developer" | "special" | "collection" | "ad";
export type MediaOwner = { type: MediaOwnerType; id: string };

export type StoredImageType = "image/jpeg" | "image/png";

const FOLDERS: Record<MediaOwnerType, string> = {
  complex: "complexes",
  developer: "developers",
  special: "specials",
  collection: "collections",
  ad: "ads",
};

export const MEDIA_PATH_PATTERN =
  /^(complexes|developers|specials|collections|ads)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/;

/** Логотип и фон — у застройщика, остальное — у ЖК (как check в media_assets); обложки витрины — по владельцу. */
export function ownerTypeOf(kind: MediaKind): MediaOwner["type"] {
  return kind === "logo" || kind === "cover" ? "developer" : "complex";
}

export function mediaFolder(owner: MediaOwner): string {
  return `${FOLDERS[owner.type]}/${owner.id}`;
}

export function mediaPath(
  owner: MediaOwner,
  type: StoredImageType,
  fileId: string = crypto.randomUUID(),
): string {
  const extension = type === "image/png" ? "png" : "jpg";
  return `${mediaFolder(owner)}/${fileId}.${extension}`;
}

/** Публичная ссылка на файл: бакет media публичный (шаг 9.1), сайт читает его мимо RLS. */
export function mediaPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Путь из формы — файл ровно в папке этого владельца (иначе руководитель привязал бы чужой). */
export function isOwnMediaPath(owner: MediaOwner, path: string): boolean {
  return MEDIA_PATH_PATTERN.test(path) && path.startsWith(`${mediaFolder(owner)}/`);
}

// Фаза 5: видео отчётов хода строительства — свой бакет, только MP4, та же папка ЖК
// (политика Storage private.is_progress_video_path).
export const PROGRESS_VIDEO_BUCKET = "progress-video";
export const PROGRESS_VIDEO_PATH_PATTERN = /^complexes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/;

export function progressVideoPath(complexId: string, fileId: string = crypto.randomUUID()): string {
  return `${mediaFolder({ type: "complex", id: complexId })}/${fileId}.mp4`;
}

export function progressVideoPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${PROGRESS_VIDEO_BUCKET}/${path}`;
}

/** Опубликованное фото отчёта (и фото отчётов до фазы E) — бакет media, папка ЖК. */
export const PROGRESS_PHOTO_PATH_PATTERN = /^complexes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;

// Проект-2, фаза E (PLAN §10, п. 13): загрузки отчёта до публикации — приватный бакет incoming,
// папка автора и ЖК (политика Storage private.is_incoming_path). В публичные бакеты файлы копирует
// сервер при публикации.
export const INCOMING_BUCKET = "incoming";
export const INCOMING_PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|mp4)$/;

export function incomingPath(
  userId: string,
  complexId: string,
  ext: "jpg" | "mp4",
  fileId: string = crypto.randomUUID(),
): string {
  return `${userId}/${complexId}/${fileId}.${ext}`;
}

/** Папка автора в ЖК — по ней докачка видео находит свою прерванную загрузку. */
export function incomingFolder(userId: string, complexId: string): string {
  return `${userId}/${complexId}/`;
}
