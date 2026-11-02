import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CATALOG_TAG, complexTag, progressTag } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { progressFramesFrom, type ProgressFrame, type ProgressFrameRecord } from "./frames";
import { unitVideoFrom, type UnitVideo, type UnitVideoRecord } from "./records";

// Видео квартиры для клиента (фаза 5): site_unit_video(id отчёта) ролью посетителя, в кэше страницы.
// Теги: отчёт (публикация и снятие), его ЖК (скрыли ЖК — страница пропадает) и CATALOG_TAG.

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function fetchUnitVideo(id: string): Promise<UnitVideo | null> {
  "use cache";
  cacheTag(CATALOG_TAG, progressTag(id));
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_unit_video", { p_id: id });
  if (error) throw new Error("site-unit-video-unavailable", { cause: error });
  if (!data) return null;
  const video = unitVideoFrom(data as UnitVideoRecord);
  cacheTag(complexTag(video.complex.id));
  return video;
}

export type UnitVideoResult =
  { kind: "page"; video: UnitVideo } | { kind: "missing" } | { kind: "unavailable" };

/** missing — отчёта нет, он не опубликован или ЖК не на сайте (404); unavailable — нет облака. */
export const readUnitVideo = cache(async (id: string): Promise<UnitVideoResult> => {
  if (!hasSupabaseEnv()) return { kind: "unavailable" };
  if (!ID.test(id)) return { kind: "missing" };
  try {
    const video = await fetchUnitVideo(id);
    return video ? { kind: "page", video } : { kind: "missing" };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[video] видео квартиры недоступно", error);
    throw error;
  }
});

async function fetchProgressFrames(): Promise<ProgressFrame[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient().rpc("site_progress_frames");
  if (error) throw new Error("site-progress-frames-unavailable", { cause: error });
  return progressFramesFrom(data as ProgressFrameRecord[] | null);
}

/**
 * Кадры стройки (5C.3) для карточек каталога и плитки главной — под тегом каталога: публикация и
 * снятие отчёта его сбрасывают. Украшение: база не ответила — без кадров, страница не падает.
 */
export const readProgressFrames = cache(async (): Promise<ProgressFrame[]> => {
  if (!hasSupabaseEnv()) return [];
  try {
    return await fetchProgressFrames();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[progress] кадры стройки недоступны", error);
    return [];
  }
});
