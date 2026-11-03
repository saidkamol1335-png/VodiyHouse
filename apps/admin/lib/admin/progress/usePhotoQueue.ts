"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INCOMING_BUCKET, incomingPath, processImage } from "@/lib/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProgressPhoto, ProgressPhotoView } from "./types";
import { isDuplicate, isRetryable, nextRetryDelay, type UploadFailure } from "./uploadRetry";

// Фото отчёта (фаза 5, мокап CabVideo «Фото · N из 3–15»; фаза E, пп. 13, 37): каждое — как фото галереи
// (processImage: JPEG ≤ 3200 px без EXIF, заглушка blur) и сразу в приватный incoming, в папку автора и
// ЖК. Обрыв связи — плитка «ждёт сети» и продолжает сама; сбой сервера — повтор. Строк media_assets нет:
// фото уходят в отчёт списком, в публичный бакет их копирует сервер при публикации.

export const PHOTOS_MAX = 15;
export const PHOTOS_MIN = 3;

export type PhotoTile = {
  key: string;
  name: string;
  state: "working" | "waiting" | "done" | "error";
  /** «Ждёт сети» или «повтор через N с». */
  wait: { reason: "offline" } | { reason: "retry"; seconds: number } | null;
  photo: ProgressPhoto | null;
  preview: string | null;
  error: "photoFailed" | "photoUploadFailed" | null;
};

type Patch = Partial<Pick<PhotoTile, "state" | "wait" | "photo" | "preview" | "error">>;

const RETRY_CAP_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Связь вернулась — событие online (или сразу, если сеть есть). */
const online = () =>
  navigator.onLine
    ? Promise.resolve()
    : new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true }));

type Upload = { path: string; blob: Blob; live: () => boolean; patch: (patch: Patch) => void };

/** Загрузка одного файла с повторами; true — файл в бакете. */
async function uploadWithRetry({ path, blob, live, patch }: Upload): Promise<boolean> {
  const storage = createSupabaseBrowserClient().storage.from(INCOMING_BUCKET);
  for (let attempt = 0; live(); attempt += 1) {
    if (!navigator.onLine) {
      patch({ state: "waiting", wait: { reason: "offline" } });
      await online();
      if (!live()) return false;
      patch({ state: "working", wait: null });
    }
    let failure: UploadFailure | null = null;
    try {
      const { error } = await storage.upload(path, blob, { contentType: "image/jpeg", upsert: false });
      failure = error as UploadFailure | null;
    } catch (error) {
      failure = error as UploadFailure;
    }
    if (!failure || isDuplicate(failure)) return true;
    // Сеть и сбои сервера — повторы без предела, не реже раза в минуту: снимок камеры не теряется.
    const delay = isRetryable(failure) ? (nextRetryDelay(attempt) ?? RETRY_CAP_MS) : null;
    if (delay === null) return false;
    patch({ state: "waiting", wait: navigator.onLine ? { reason: "retry", seconds: delay / 1000 } : { reason: "offline" } });
    await sleep(delay);
    if (live()) patch({ state: "working", wait: null });
  }
  return false;
}

const storedTile = (photo: ProgressPhotoView): PhotoTile => ({
  key: photo.path,
  name: photo.path.split("/").at(-1) ?? photo.path,
  state: "done",
  wait: null,
  photo: { path: photo.path, width: photo.width, height: photo.height, blur: photo.blur },
  preview: photo.url || null,
  error: null,
});

const newTile = (file: File, key: string): PhotoTile => ({
  key,
  name: file.name,
  state: "working",
  wait: null,
  photo: null,
  preview: null,
  error: null,
});

/** Превью — адреса blob: в памяти вкладки; освобождаются при удалении фото и уходе со страницы. */
function usePreviews() {
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const all = previews.current;
    return () => all.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const keep = useCallback((url: string | null) => {
    if (url?.startsWith("blob:")) previews.current.add(url);
  }, []);
  const release = useCallback((list: readonly PhotoTile[]) => {
    for (const tile of list) {
      if (!tile.preview?.startsWith("blob:")) continue;
      URL.revokeObjectURL(tile.preview);
      previews.current.delete(tile.preview);
    }
  }, []);
  return { keep, release };
}

/** Ключи плиток, которые ещё в очереди: догрузившееся фото убранной плитки в форму не попадает. */
function useLiveKeys(tiles: readonly PhotoTile[]) {
  const live = useRef(new Set(tiles.map((tile) => tile.key)));
  useEffect(() => {
    live.current = new Set(tiles.map((tile) => tile.key));
  }, [tiles]);
  return live;
}

type QueueOwner = { userId: string; complexId: string | null };

type TileContext = {
  owner: { userId: string; complexId: string };
  /** Живые ключи очереди — ссылка: набор пересобирается при каждой смене плиток. */
  live: { current: Set<string> };
  keep: (url: string | null) => void;
  setTiles: (next: (current: PhotoTile[]) => PhotoTile[]) => void;
};

/** Одно фото: обработка, превью, загрузка с повторами; убранная плитка формы не трогает. */
async function processTile(file: File, key: string, { owner, live, keep, setTiles }: TileContext) {
  const patch = (next: Patch) =>
    live.current.has(key) && setTiles((current) => current.map((tile) => (tile.key === key ? { ...tile, ...next } : tile)));
  const processed = await processImage(file, "photo");
  if (!processed.ok) return patch({ state: "error", error: "photoFailed" });
  const { image } = processed;
  const preview = URL.createObjectURL(image.blob);
  if (!live.current.has(key)) return URL.revokeObjectURL(preview);
  keep(preview);
  patch({ preview });
  const path = incomingPath(owner.userId, owner.complexId, "jpg");
  const ok = await uploadWithRetry({ path, blob: image.blob, live: () => live.current.has(key), patch });
  patch(
    ok
      ? { state: "done", wait: null, photo: { path, width: image.width, height: image.height, blur: image.blur } }
      : { state: "error", wait: null, error: "photoUploadFailed" },
  );
}

/** Очередь фото одного ЖК: добавить (до 15; add отвечает, сколько файлов принято), убрать, сбросить. */
export function usePhotoQueue({ userId, complexId }: QueueOwner, initial: readonly ProgressPhotoView[] = []) {
  // Черновик и возвращённый отчёт: их фото уже в бакете — плитки сразу «загружены».
  const [tiles, setTiles] = useState<PhotoTile[]>(() => initial.map(storedTile));
  const { keep, release } = usePreviews();
  const live = useLiveKeys(tiles);
  // Файлы плиток — для «Повторить» после отказа (снимок камеры в галерею не попадает).
  const sources = useRef(new Map<string, File>());
  const start = (file: File, key: string) =>
    complexId && void processTile(file, key, { owner: { userId, complexId }, live, keep, setTiles });

  const add = (files: readonly File[]): number => {
    if (!complexId) return 0;
    const room = Math.max(0, PHOTOS_MAX - tiles.length);
    const taken = files.slice(0, room).map((file) => ({ file, key: crypto.randomUUID() }));
    for (const { file, key } of taken) {
      live.current.add(key);
      sources.current.set(key, file);
    }
    setTiles((current) => [...current, ...taken.map(({ file, key }) => newTile(file, key))]);
    for (const { file, key } of taken) start(file, key);
    return taken.length;
  };
  const drop = (keys: readonly string[] | null) =>
    setTiles((current) => {
      const gone = keys ? current.filter((tile) => keys.includes(tile.key)) : current;
      for (const tile of gone) {
        live.current.delete(tile.key);
        sources.current.delete(tile.key);
      }
      release(gone);
      return keys ? current.filter((tile) => !keys.includes(tile.key)) : [];
    });
  const retry = (key: string) => {
    const file = sources.current.get(key);
    if (!file) return;
    setTiles((current) => current.map((tile) => (tile.key === key ? { ...tile, state: "working", error: null } : tile)));
    start(file, key);
  };
  const photos = tiles.flatMap((tile) => (tile.photo ? [tile.photo] : []));
  const working = tiles.some((tile) => tile.state === "working" || tile.state === "waiting");
  return { tiles, photos, working, add, remove: (key: string) => drop([key]), reset: () => drop(null), retry };
}
