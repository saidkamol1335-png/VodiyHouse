"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MEDIA_BUCKET, mediaPath, mediaPublicUrl, processImage } from "@/lib/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProgressPhoto } from "./types";

// Фото отчёта (фаза 5, мокап CabVideo «Фото · N из 3–15»): каждое — как фото галереи (processImage:
// JPEG ≤ 3200 px без EXIF, заглушка blur) и сразу в бакет media, в папку ЖК, сессией сотрудника.
// Строк media_assets нет: фото уходят в submit_progress_report списком.

export const PHOTOS_MAX = 15;
export const PHOTOS_MIN = 3;

export type PhotoTile = {
  key: string;
  name: string;
  state: "working" | "done" | "error";
  photo: ProgressPhoto | null;
  preview: string | null;
  error: "photoFailed" | "photoUploadFailed" | null;
};

async function uploadPhoto(
  complexId: string,
  file: File,
): Promise<Pick<PhotoTile, "photo" | "preview" | "error">> {
  const processed = await processImage(file, "photo");
  if (!processed.ok) return { photo: null, preview: null, error: "photoFailed" };
  const { image } = processed;
  const path = mediaPath({ type: "complex", id: complexId }, "image/jpeg");
  const { error } = await createSupabaseBrowserClient()
    .storage.from(MEDIA_BUCKET)
    .upload(path, image.blob, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) return { photo: null, preview: null, error: "photoUploadFailed" };
  return {
    photo: { path, width: image.width, height: image.height, blur: image.blur },
    preview: URL.createObjectURL(image.blob),
    error: null,
  };
}

const storedTile = (photo: ProgressPhoto): PhotoTile => ({
  key: photo.path,
  name: photo.path.split("/").at(-1) ?? photo.path,
  state: "done",
  photo,
  preview: mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", photo.path),
  error: null,
});

const newTile = (file: File, key: string): PhotoTile => ({
  key,
  name: file.name,
  state: "working",
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
    if (url) previews.current.add(url);
  }, []);
  const release = useCallback((list: readonly PhotoTile[]) => {
    for (const tile of list) {
      if (!tile.preview) continue;
      URL.revokeObjectURL(tile.preview);
      previews.current.delete(tile.preview);
    }
  }, []);
  return { keep, release };
}

/** Плитка key — с итогом загрузки: фото и превью или ошибка. */
const settled = (
  tiles: readonly PhotoTile[],
  key: string,
  result: Pick<PhotoTile, "photo" | "preview" | "error">,
) =>
  tiles.map((tile) =>
    tile.key === key
      ? { ...tile, ...result, state: result.error ? ("error" as const) : ("done" as const) }
      : tile,
  );

/** Ключи плиток, которые ещё в очереди: догрузившееся фото убранной плитки в форму не попадает. */
function useLiveKeys(tiles: readonly PhotoTile[]) {
  const live = useRef(new Set(tiles.map((tile) => tile.key)));
  useEffect(() => {
    live.current = new Set(tiles.map((tile) => tile.key));
  }, [tiles]);
  return live;
}

/** Очередь фото одного ЖК: добавить (до 15; add отвечает, сколько файлов принято), убрать, сбросить. */
export function usePhotoQueue(complexId: string | null, initial: readonly ProgressPhoto[] = []) {
  // Исправление возвращённого отчёта: его фото уже в бакете — плитки сразу «загружены».
  const [tiles, setTiles] = useState<PhotoTile[]>(() => initial.map(storedTile));
  const { keep, release } = usePreviews();
  const live = useLiveKeys(tiles);

  const add = (files: readonly File[]): number => {
    if (!complexId) return 0;
    const room = Math.max(0, PHOTOS_MAX - tiles.length);
    const taken = files.slice(0, room).map((file) => ({ file, key: crypto.randomUUID() }));
    for (const { key } of taken) live.current.add(key);
    setTiles((current) => [...current, ...taken.map(({ file, key }) => newTile(file, key))]);
    for (const { file, key } of taken) {
      void uploadPhoto(complexId, file).then((result) => {
        // Плитку уже убрали (сброс, другой ЖК) — превью сразу освобождается, в форму фото не попадает.
        if (!live.current.has(key)) {
          if (result.preview) URL.revokeObjectURL(result.preview);
          return;
        }
        keep(result.preview);
        setTiles((current) => settled(current, key, result));
      });
    }
    return taken.length;
  };
  const remove = (key: string) => {
    live.current.delete(key);
    setTiles((current) => {
      release(current.filter((tile) => tile.key === key));
      return current.filter((tile) => tile.key !== key);
    });
  };
  const reset = () => {
    live.current.clear();
    setTiles((current) => {
      release(current);
      return [];
    });
  };
  const photos = tiles.flatMap((tile) => (tile.photo ? [tile.photo] : []));
  const working = tiles.some((tile) => tile.state === "working");
  return { tiles, photos, working, add, remove, reset };
}
