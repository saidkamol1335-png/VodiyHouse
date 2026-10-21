"use server";

import { requirementsFromDetail } from "@/lib/admin/complexes/readiness";
import type { ComplexMediaResult } from "@/lib/admin/complexes/types";
import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { removeMediaFiles } from "@/lib/admin/server/mediaFiles";
import { expireComplex, markComplexStale } from "@/lib/cache";
import { requireActionViewer } from "@/lib/admin/session";
import { clampFocus, isOwnMediaPath } from "@/lib/media";

// Фото галереи и чертежи ЖК (И5, И6). Файл уже в бакете — его положил браузер сессией
// руководителя (политика Storage, папка ЖК). Здесь — строки media_assets через функции базы и
// удаление файлов через Storage API (прямой delete в storage.objects запрещён).

const MAX_SIDE = 10_000;
const BLUR_MAX = 4000;

type DbError = { code?: string; hint?: string; message?: string; details?: string | null };

const fail = (error: ContentErrorCode, dbError?: DbError): ComplexMediaResult => ({
  status: "error",
  error,
  broken: dbError?.hint === "vh:not_ready" ? requirementsFromDetail(dbError.details) : [],
});

const headGuard = () => requireActionViewer(["head"]);

function readSide(formData: FormData, name: string): number | null {
  const value = Number(readText(formData, name));
  return Number.isInteger(value) && value > 0 && value <= MAX_SIDE ? value : null;
}

type FileFields = { id: string; path: string; width: number; height: number; blur: string | null };

function readFile(formData: FormData): FileFields | null {
  const id = readUuid(formData);
  const path = readText(formData, "path") ?? "";
  const width = readSide(formData, "width");
  const height = readSide(formData, "height");
  const blur = readText(formData, "blur") || null;
  if (!id || !width || !height || !isOwnMediaPath({ type: "complex", id }, path)) return null;
  if (blur && blur.length > BLUR_MAX) return null;
  return { id, path, width, height, blur };
}

type Supabase = Extract<Awaited<ReturnType<typeof headGuard>>, { ok: true }>["supabase"];

/** Новый файл ЖК: фото — в конец галереи, чертёж — для привязки при сохранении планировок. */
async function attach(
  supabase: Supabase,
  formData: FormData,
  fn: "add_complex_photo" | "add_complex_drawing",
): Promise<ComplexMediaResult> {
  const file = readFile(formData);
  if (!file) return fail("invalid");
  const { data, error } = await supabase.rpc(fn, {
    p_complex: file.id,
    p_path: file.path,
    p_width: file.width,
    p_height: file.height,
    p_blur: file.blur,
    p_rule12: readText(formData, "rule12") === "on",
  });
  if (error) return fail(contentDbErrorCode(error), error);
  return typeof data === "string" ? { status: "done", id: data } : fail("unknown");
}

/** Поля: id (ЖК), path, width, height, blur, rule12. Ответ — id новой строки. */
export async function attachComplexPhotoAction(formData: FormData): Promise<ComplexMediaResult> {
  const guard = await headGuard();
  if (!guard.ok) return fail(guard.code);
  const result = await attach(guard.supabase, formData, "add_complex_photo");
  if (result.status === "done") expireComplex(readUuid(formData));
  return result;
}

/** Поля те же; строка чертежа привязывается к планировке при «Сохранить вкладку». */
export async function attachComplexDrawingAction(formData: FormData): Promise<ComplexMediaResult> {
  const guard = await headGuard();
  if (!guard.ok) return fail(guard.code);
  return attach(guard.supabase, formData, "add_complex_drawing");
}

/** Поля: id (ЖК), order — JSON-массив id фото в новом порядке (первое — обложка). */
export async function reorderComplexPhotosAction(formData: FormData): Promise<ComplexMediaResult> {
  const guard = await headGuard();
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  let order: unknown;
  try {
    order = JSON.parse(readText(formData, "order") ?? "");
  } catch {
    return fail("invalid");
  }
  if (!id || !Array.isArray(order) || !order.every((item) => typeof item === "string"))
    return fail("invalid");
  const { error } = await guard.supabase.rpc("reorder_complex_photos", {
    p_complex: id,
    p_ids: order,
  });
  if (error) return fail(contentDbErrorCode(error), error);
  expireComplex(id);
  return { status: "done", id };
}

/** Поля: id (ЖК), photo. Опубликованный ЖК не опускается ниже условий публикации. */
export async function removeComplexPhotoAction(formData: FormData): Promise<ComplexMediaResult> {
  const guard = await headGuard();
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const photo = readUuid(formData, "photo");
  if (!id || !photo) return fail("invalid");
  const { data, error } = await guard.supabase.rpc("remove_complex_photo", {
    p_complex: id,
    p_id: photo,
  });
  if (error) return fail(contentDbErrorCode(error), error);
  await removeMediaFiles(guard.supabase, data);
  expireComplex(id);
  return { status: "done", id: photo };
}

/** Поля: id (ЖК), photo, focusX, focusY — кадры 16:9 / 4:3 / 4:5 считаются от точки (в. 4). */
export async function setComplexPhotoFocusAction(formData: FormData): Promise<ComplexMediaResult> {
  const guard = await headGuard();
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const photo = readUuid(formData, "photo");
  if (!id || !photo) return fail("invalid");
  const focus = clampFocus({
    x: Number(readText(formData, "focusX") ?? 0.5),
    y: Number(readText(formData, "focusY") ?? 0.5),
  });
  const { data, error } = await guard.supabase
    .from("media_assets")
    .update({ focus_x: focus.x, focus_y: focus.y })
    .eq("id", photo)
    .eq("complex_id", id)
    .select("id");
  if (error) return fail(contentDbErrorCode(error), error);
  if (!data?.length) return fail("notFound");
  markComplexStale(id);
  return { status: "done", id: photo };
}
