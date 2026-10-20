import "server-only";
import { cache } from "react";
import type { MediaPreview } from "@/components/MediaDrop";
import { mediaPublicUrl } from "@/lib/media";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readDeveloper, readDeveloperMedia, type DeveloperMedia } from "./developers";

// Страница застройщика: layout (шапка, статус, вкладки) и вкладка читают одного и того же
// застройщика — один раз на запрос (React.cache).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null — адрес не uuid или застройщика нет (notFound). */
export const getDeveloper = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  return readDeveloper(await createSupabaseServerClient(), id.toLowerCase());
});

/** Публичная ссылка на файл бакета media для превью в кабинете. */
export function mediaSrc(path: string): string {
  return mediaPublicUrl(supabasePublicEnv().url, path);
}

function previewOf(media: DeveloperMedia | undefined): MediaPreview | null {
  if (!media) return null;
  return {
    src: mediaSrc(media.path),
    width: media.width,
    height: media.height,
    focus: { x: media.focusX, y: media.focusY },
  };
}

export async function getDeveloperPreviews(id: string) {
  const media = await readDeveloperMedia(await createSupabaseServerClient(), id);
  return {
    logo: previewOf(media.find((item) => item.kind === "logo")),
    cover: previewOf(media.find((item) => item.kind === "cover")),
  };
}
