"use server";

import type { ComplexMediaResult } from "@/lib/admin/complexes/types";
import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { parseContour, parseFloorRange, parseUnitContours, type Point, type UnitContour } from "@/lib/admin/facade/contours";
import type { FacadeResult } from "@/lib/admin/facade/types";
import { removeMediaFiles } from "@/lib/admin/server/mediaFiles";
import { requireActionViewer } from "@/lib/admin/session";
import { complexIdFrom, expireComplex } from "@/lib/cache";
import { isOwnMediaPath } from "@/lib/media";

// Вкладка ЖК «Фасад и планы» (фаза 4): фасад, контуры блоков, планы этажей и контуры квартир.
// Файл уже в бакете (его положил браузер сессией руководителя); здесь — функции базы, удаление
// старых файлов через Storage API и сброс кэша страницы ЖК: раздел «Выбрать квартиру» — сразу.

const MAX_SIDE = 10_000;
const BLUR_MAX = 4000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const headGuard = () => requireActionViewer(["head"]);

const failMedia = (error: ContentErrorCode): ComplexMediaResult => ({ status: "error", error, broken: [] });
const failed = (error: ContentErrorCode): FacadeResult => ({ status: "error", error });

function readSide(formData: FormData, name: string): number | null {
  const value = Number(readText(formData, name));
  return Number.isInteger(value) && value > 0 && value <= MAX_SIDE ? value : null;
}

type FileFields = { complexId: string; path: string; width: number; height: number; blur: string | null };

/** Поля файла: id (ЖК), path, width, height, blur. null — файла нет или он не той папки. */
function readFile(formData: FormData): FileFields | null {
  const complexId = readUuid(formData);
  const path = readText(formData, "path") ?? "";
  const width = readSide(formData, "width");
  const height = readSide(formData, "height");
  const blur = readText(formData, "blur") || null;
  if (!complexId || !width || !height || !isOwnMediaPath({ type: "complex", id: complexId }, path)) return null;
  if (blur && blur.length > BLUR_MAX) return null;
  return { complexId, path, width, height, blur };
}

type Answer = { complex_id?: string; old_path?: string | null; id?: string } | null;

/** Ответ базы: старый файл — из бакета (кэш страницы ЖК сбрасывает само действие). */
async function settle(supabase: Parameters<typeof removeMediaFiles>[0], data: unknown) {
  const answer = data as Answer;
  await removeMediaFiles(supabase, answer?.old_path ?? null);
  return answer;
}

/** Фасад ЖК. Поля: id (ЖК), path, width, height, blur, rule12. Ответ — id ЖК. */
export async function setComplexFacadeAction(formData: FormData): Promise<ComplexMediaResult> {
  const guard = await headGuard();
  if (!guard.ok) return failMedia(guard.code);
  const file = readFile(formData);
  if (!file) return failMedia("invalid");
  const { data, error } = await guard.supabase.rpc("set_complex_facade", {
    p_complex: file.complexId,
    p_path: file.path,
    p_width: file.width,
    p_height: file.height,
    p_blur: file.blur,
    p_rule12: readText(formData, "rule12") === "on",
  });
  if (error) return failMedia(contentDbErrorCode(error));
  await settle(guard.supabase, data);
  expireComplex(complexIdFrom(data));
  return { status: "done", id: file.complexId };
}

export async function removeComplexFacadeAction(complexId: string): Promise<FacadeResult> {
  const guard = await headGuard();
  if (!guard.ok) return failed(guard.code);
  if (typeof complexId !== "string" || !UUID.test(complexId)) return failed("invalid");
  const { data, error } = await guard.supabase.rpc("remove_complex_facade", { p_complex: complexId });
  if (error) return failed(contentDbErrorCode(error));
  await settle(guard.supabase, data);
  expireComplex(complexIdFrom(data));
  return { status: "done" };
}

/** Контур блока на фасаде; null — снять. */
export async function setBlockContourAction(blockId: string, contour: Point[] | null): Promise<FacadeResult> {
  const guard = await headGuard();
  if (!guard.ok) return failed(guard.code);
  const points = contour === null ? null : parseContour(contour);
  if (typeof blockId !== "string" || !UUID.test(blockId) || (contour !== null && !points)) return failed("invalid");
  const { data, error } = await guard.supabase.rpc("set_block_contour", { p_block: blockId, p_contour: points });
  if (error) return failed(contentDbErrorCode(error));
  expireComplex(complexIdFrom(data));
  return { status: "done" };
}

/**
 * План этажа: новый (с картинкой) или правка. Поля: plan (пусто — новый), block, entrance (пусто —
 * весь этаж), from, to; с новой картинкой — id (ЖК), path, width, height, blur, rule12. Ответ — id плана.
 */
export async function saveFloorPlanAction(formData: FormData): Promise<ComplexMediaResult> {
  const guard = await headGuard();
  if (!guard.ok) return failMedia(guard.code);
  const plan = readText(formData, "plan") || null;
  const block = readText(formData, "block") ?? "";
  const entrance = readText(formData, "entrance") ? Number(readText(formData, "entrance")) : null;
  const [from, to] = [Number(readText(formData, "from")), Number(readText(formData, "to"))];
  const file = readText(formData, "path") ? readFile(formData) : null;
  if ((plan && !UUID.test(plan)) || !UUID.test(block) || (readText(formData, "path") && !file)) return failMedia("invalid");
  if ((entrance !== null && !(Number.isInteger(entrance) && entrance >= 1 && entrance <= 50)) || !parseFloorRange(from, to, null)) {
    return failMedia("invalid");
  }
  // Картинка — из папки того ЖК, чей это блок: иначе удаление плана унесло бы чужой файл.
  if (file) {
    const { data: owner } = await guard.supabase.from("blocks").select("complex_id").eq("id", block).maybeSingle();
    if ((owner as { complex_id: string } | null)?.complex_id !== file.complexId) return failMedia("invalid");
  }
  const { data, error } = await guard.supabase.rpc("save_floor_plan", {
    p_plan: plan,
    p_block: block,
    p_entrance: entrance,
    p_floor_from: from,
    p_floor_to: to,
    p_path: file?.path ?? null,
    p_width: file?.width ?? null,
    p_height: file?.height ?? null,
    p_blur: file?.blur ?? null,
    p_rule12: readText(formData, "rule12") === "on",
  });
  if (error) return failMedia(contentDbErrorCode(error));
  const answer = await settle(guard.supabase, data);
  expireComplex(complexIdFrom(data));
  return answer?.id ? { status: "done", id: answer.id } : failMedia("unknown");
}

/** Контуры квартир плана целиком; entrance — подъезд плана (null — весь этаж). */
export async function setFloorPlanContoursAction(
  planId: string,
  entrance: number | null,
  contours: UnitContour[],
): Promise<FacadeResult> {
  const guard = await headGuard();
  if (!guard.ok) return failed(guard.code);
  const parsed = parseUnitContours(contours, entrance);
  if (typeof planId !== "string" || !UUID.test(planId) || !parsed) return failed("invalid");
  const { data, error } = await guard.supabase.rpc("set_floor_plan_contours", { p_plan: planId, p_contours: parsed });
  if (error) return failed(contentDbErrorCode(error));
  expireComplex(complexIdFrom(data));
  return { status: "done" };
}

export async function deleteFloorPlanAction(planId: string): Promise<FacadeResult> {
  const guard = await headGuard();
  if (!guard.ok) return failed(guard.code);
  if (typeof planId !== "string" || !UUID.test(planId)) return failed("invalid");
  const { data, error } = await guard.supabase.rpc("delete_floor_plan", { p_plan: planId });
  if (error) return failed(contentDbErrorCode(error));
  await settle(guard.supabase, data);
  expireComplex(complexIdFrom(data));
  return { status: "done" };
}
