"use server";

import { readText, readUuid } from "@/lib/admin/credentials";
import { readBilingual } from "@/lib/admin/bilingual";
import { youtubeIdFrom } from "@/lib/admin/complexes/videos";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import type {
  ProgressPhoto,
  ProgressSubmitResult,
  ProgressUnitOption,
} from "@/lib/admin/progress/types";
import { removeProgressFilesAsServer } from "@/lib/admin/server/mediaFiles";
import { requireActionViewer } from "@/lib/admin/session";
import { PROGRESS_VIDEO_PATH_PATTERN } from "@/lib/media";

// «Видео и ход стройки» (фаза 5, 5B): видеограф и руководитель отправляют отчёт на проверку. Фото и видео
// уже в бакетах — их положил браузер сессией сотрудника (политики Storage, папка ЖК). Здесь — проверка
// формы и submit_progress_report: правила отчёта (месяц, 3–15 фото, комментарий RU и UZ) решает база.

const MONTH = /^\d{4}-\d{2}-01$/;
const MAX_SIDE = 20_000;
const BLUR_MAX = 4000;

const fail = (error: ContentErrorCode): ProgressSubmitResult => ({ status: "error", error });

function isPhoto(value: unknown): value is ProgressPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Record<string, unknown>;
  const side = (n: unknown) =>
    Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_SIDE;
  return (
    typeof photo.path === "string" &&
    side(photo.width) &&
    side(photo.height) &&
    (photo.blur === null || (typeof photo.blur === "string" && photo.blur.length <= BLUR_MAX))
  );
}

function readPhotos(formData: FormData): ProgressPhoto[] | null {
  try {
    const parsed: unknown = JSON.parse(readText(formData, "photos") ?? "");
    return Array.isArray(parsed) && parsed.every(isPhoto)
      ? parsed.map(({ path, width, height, blur }) => ({ path, width, height, blur }))
      : null;
  } catch {
    return null;
  }
}

/** Видео: ссылка YouTube (любая форма адреса) или путь файла в progress-video; пусто — без видео. */
function readVideo(
  formData: FormData,
): { youtube_id: string | null; video_path: string | null } | null {
  const link = readText(formData, "youtube")?.trim() ?? "";
  const path = readText(formData, "videoPath")?.trim() ?? "";
  const youtube = link ? youtubeIdFrom(link) : null;
  if (link && !youtube) return null;
  if (path && !PROGRESS_VIDEO_PATH_PATTERN.test(path)) return null;
  return { youtube_id: youtube, video_path: path || null };
}

/** Квартиры блока для «Квартира · необязательно»: без проданных, по этажам. */
export async function readProgressUnitsAction(
  blockId: string,
): Promise<ProgressUnitOption[] | null> {
  const guard = await requireActionViewer(["head", "videographer"]);
  if (!guard.ok || typeof blockId !== "string") return null;
  const [units, layouts] = await Promise.all([
    guard.supabase
      .from("units")
      .select("id, number, floor, status, layout_id")
      .eq("block_id", blockId)
      .neq("status", "sold")
      .order("floor")
      .order("position"),
    guard.supabase.from("layouts").select("id, rooms, area").eq("block_id", blockId),
  ]);
  if (units.error || layouts.error) return null;
  const layoutOf = new Map((layouts.data ?? []).map((layout) => [layout.id as string, layout]));
  return (units.data ?? []).map((unit) => {
    const layout = unit.layout_id ? layoutOf.get(unit.layout_id as string) : undefined;
    return {
      id: unit.id as string,
      number: unit.number as string,
      floor: unit.floor as number,
      status: unit.status as ProgressUnitOption["status"],
      rooms: layout ? Number(layout.rooms) : null,
      area: layout ? Number(layout.area) : null,
    };
  });
}

/**
 * «Отправить на проверку»: новый отчёт или исправленный возвращённый (id). Файлы, которые база
 * больше не держит (исправленный отчёт без старых фото), удаляет сервер.
 */
export async function submitProgressReportAction(
  formData: FormData,
): Promise<ProgressSubmitResult> {
  // Сессию проверяет сам Auth (fresh): дальше файлы удаляет секретный ключ сервера.
  const guard = await requireActionViewer(["head", "videographer"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const blockId = readUuid(formData, "blockId");
  const unitId = readText(formData, "unitId") ? readUuid(formData, "unitId") : null;
  const month = readText(formData, "month");
  const photos = readPhotos(formData);
  const video = readVideo(formData);
  if (!video) return fail("reportYoutube");
  if (
    !blockId ||
    !month ||
    !MONTH.test(month) ||
    !photos ||
    (readText(formData, "unitId") && !unitId)
  ) {
    return fail("invalid");
  }
  if (photos.length < 3 || photos.length > 15) return fail("reportPhotos");
  const comment = readBilingual(formData, "comment");
  if (!comment.ru.trim() || !comment.uz.trim()) return fail("reportComment");
  const id = readText(formData, "id") ? readUuid(formData, "id") : null;
  const { data, error } = await guard.supabase.rpc("submit_progress_report", {
    p_report: { id, block_id: blockId, unit_id: unitId, month, comment, photos, ...video },
  });
  if (error) {
    const code = contentDbErrorCode(error);
    // Один отчёт по блоку за месяц: общий «Такое значение уже есть» видеографу ничего не скажет.
    return fail(code === "duplicate" ? "reportDuplicate" : code);
  }
  const result = data as { id: string; removed: string[] };
  await removeProgressFilesAsServer(result.removed);
  return { status: "done", id: result.id };
}
