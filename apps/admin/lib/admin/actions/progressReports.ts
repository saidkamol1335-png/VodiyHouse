"use server";

import { readText, readUuid } from "@/lib/admin/credentials";
import { readBilingual } from "@/lib/admin/bilingual";
import { youtubeIdFrom } from "@/lib/admin/complexes/videos";
import { bilingualHasContact } from "@/lib/admin/contactGuard";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import type { ProgressNotice } from "@/lib/admin/progress/notify";
import type { ProgressPhoto, ProgressSaveResult, ProgressUnitOption } from "@/lib/admin/progress/types";
import { removeProgressFilesAsServer } from "@/lib/admin/server/mediaFiles";
import { notifyHeadSubmitted } from "@/lib/admin/server/progressNotify";
import { requireActionViewer } from "@/lib/admin/session";
import { INCOMING_PATH_PATTERN, PROGRESS_VIDEO_PATH_PATTERN } from "@/lib/media";

// «Видео и ход стройки» (фаза 5; Проект-2, фаза E — PLAN §10, пп. 31–33, 36): мобилограф и руководитель
// сохраняют черновик или отправляют отчёт на проверку. Фото и видео уже в приватном incoming — их положил
// браузер сессией сотрудника. Правила отчёта (дата съёмки, 3–15 фото, комментарий RU и UZ, свои свежие
// файлы) решает база; здесь — разбор формы, правило 1.2 в комментарии и уведомление руководителю.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SIDE = 20_000;
const BLUR_MAX = 4000;

const fail = (error: ContentErrorCode): ProgressSaveResult => ({ status: "error", error });

function isPhoto(value: unknown): value is ProgressPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Record<string, unknown>;
  const side = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_SIDE;
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

/** Видео: ссылка YouTube (любая форма адреса) или путь файла — свой incoming или уже бывший в отчёте. */
function readVideo(formData: FormData): { youtube_id: string | null; video_path: string | null } | null {
  const link = readText(formData, "youtube")?.trim() ?? "";
  const path = readText(formData, "videoPath")?.trim() ?? "";
  const youtube = link ? youtubeIdFrom(link) : null;
  if (link && !youtube) return null;
  if (path && !INCOMING_PATH_PATTERN.test(path) && !PROGRESS_VIDEO_PATH_PATTERN.test(path)) return null;
  return { youtube_id: youtube, video_path: path || null };
}

type ReportBody = {
  id: string | null;
  block_id: string;
  unit_id: string | null;
  shot_on: string;
  comment: { ru: string; uz: string };
  photos: ProgressPhoto[];
  youtube_id: string | null;
  video_path: string | null;
};

/** Форма → тело отчёта; неполноту черновика пропускает, «На проверку» проверяет целиком (дальше — база). */
function readReport(formData: FormData, submit: boolean): ReportBody | ContentErrorCode {
  const blockId = readUuid(formData, "blockId");
  const unitId = readText(formData, "unitId") ? readUuid(formData, "unitId") : null;
  const id = readText(formData, "id") ? readUuid(formData, "id") : null;
  const shotOn = readText(formData, "shotOn") ?? "";
  const photos = readPhotos(formData);
  const video = readVideo(formData);
  if (!video) return "reportYoutube";
  if (!blockId || !photos || (readText(formData, "unitId") && !unitId) || (readText(formData, "id") && !id)) {
    return "invalid";
  }
  if (!DAY.test(shotOn)) return "reportShotDate";
  if (photos.length > 15 || (submit && photos.length < 3)) return "reportPhotos";
  const comment = readBilingual(formData, "comment");
  if (submit && (!comment.ru.trim() || !comment.uz.trim())) return "reportComment";
  return { id, block_id: blockId, unit_id: unitId, shot_on: shotOn, comment, photos, ...video };
}

/** Квартиры блока для «Квартира · необязательно»: без проданных, по этажам. */
export async function readProgressUnitsAction(blockId: string): Promise<ProgressUnitOption[] | null> {
  const guard = await requireActionViewer(["head", "mobilographer"]);
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

type Saved = { id: string; removed: string[]; notice: ProgressNotice };

/** Ошибка базы → код формы: один отчёт по блоку за месяц — понятным текстом. */
const saveError = (error: Parameters<typeof contentDbErrorCode>[0]) => {
  const code = contentDbErrorCode(error);
  return fail(code === "duplicate" ? "reportDuplicate" : code);
};

/**
 * «Сохранить черновик» (п. 32): неполный отчёт — новый, свой черновик или возвращённый. Файлы, которые
 * база больше не держит (убранные из отчёта), удаляет сервер.
 */
export async function saveProgressDraftAction(formData: FormData): Promise<ProgressSaveResult> {
  // Сессию проверяет сам Auth (fresh): дальше файлы удаляет секретный ключ сервера.
  const guard = await requireActionViewer(["head", "mobilographer"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const body = readReport(formData, false);
  if (typeof body === "string") return fail(body);
  const { data, error } = await guard.supabase.rpc("save_progress_draft", { p_report: body });
  if (error) return saveError(error);
  const saved = data as Saved;
  await removeProgressFilesAsServer(saved.removed);
  return { status: "saved", id: saved.id };
}

/**
 * «На проверку»: новый отчёт, черновик или исправленный возвращённый (id). Контакты в комментарии — отказ
 * (правило 1.2); после отправки — сообщение руководителю в Telegram со ссылкой на отчёт (п. 36).
 */
export async function submitProgressReportAction(formData: FormData): Promise<ProgressSaveResult> {
  const guard = await requireActionViewer(["head", "mobilographer"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const body = readReport(formData, true);
  if (typeof body === "string") return fail(body);
  if (bilingualHasContact(body.comment)) return fail("contacts");
  const { data, error } = await guard.supabase.rpc("submit_progress_report", { p_report: body });
  if (error) return saveError(error);
  const saved = data as Saved;
  await removeProgressFilesAsServer(saved.removed);
  const notified = await notifyHeadSubmitted(saved.notice, saved.id).catch(() => false);
  return { status: "done", id: saved.id, notified };
}

/** «Удалить» черновик или свой возвращённый отчёт; руководитель — любой видимый. Файлы — сервер. */
export async function deleteProgressReportAction(formData: FormData): Promise<ProgressSaveResult> {
  const guard = await requireActionViewer(["head", "mobilographer"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData, "id");
  if (!id) return fail("invalid");
  const { data, error } = await guard.supabase.rpc("delete_progress_report", { p_id: id });
  if (error) return fail(contentDbErrorCode(error));
  await removeProgressFilesAsServer((data as { removed: string[] }).removed);
  return { status: "saved", id };
}
