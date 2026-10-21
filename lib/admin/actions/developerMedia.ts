"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import type { MediaActionResult } from "@/lib/admin/developers/types";
import { requireActionViewer } from "@/lib/admin/session";
import { clampFocus, isOwnMediaPath, MEDIA_BUCKET, type FocusPoint } from "@/lib/media";

// Логотип и фон застройщика (шаг 9.4, решение Д4). Файл уже в бакете — его положил браузер
// сессией руководителя (политика Storage). Здесь — строка media_assets и удаление старого файла:
// прямой delete в storage.objects запрещён, только Storage API.

type DeveloperMediaKind = "logo" | "cover";

const MAX_SIDE = 10_000;
const BLUR_MAX = 4000;

const fail = (error: ContentErrorCode): MediaActionResult => ({ status: "error", error });

function readKind(formData: FormData): DeveloperMediaKind | null {
  const kind = readText(formData, "kind");
  return kind === "logo" || kind === "cover" ? kind : null;
}

function readSide(formData: FormData, name: string): number | null {
  const value = Number(readText(formData, name));
  return Number.isInteger(value) && value > 0 && value <= MAX_SIDE ? value : null;
}

function readFocus(formData: FormData): FocusPoint {
  return clampFocus({
    x: Number(readText(formData, "focusX") ?? 0.5),
    y: Number(readText(formData, "focusY") ?? 0.5),
  });
}

/** Старый файл — уборка: если Storage не ответил, файл останется, а строка уже новая. */
async function removeFile(supabase: SupabaseClient, path: unknown): Promise<void> {
  if (typeof path !== "string" || !path) return;
  try {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  } catch {
    // Сирота в бакете не видна на сайте; чистка бакета — вместе с окончательным удалением (фаза 3).
  }
}

/** Новый логотип или фон: заменяет прежний одной транзакцией базы. */
export async function attachDeveloperMediaAction(formData: FormData): Promise<MediaActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const kind = readKind(formData);
  const path = readText(formData, "path") ?? "";
  const width = readSide(formData, "width");
  const height = readSide(formData, "height");
  const blur = readText(formData, "blur");
  if (!id || !kind || !width || !height || !isOwnMediaPath({ type: "developer", id }, path))
    return fail("invalid");
  if (blur && blur.length > BLUR_MAX) return fail("invalid");

  const focus = readFocus(formData);
  const { data, error } = await guard.supabase.rpc("set_developer_media", {
    p_developer: id,
    p_kind: kind,
    p_path: path,
    p_width: width,
    p_height: height,
    p_blur: blur || null,
    p_focus_x: focus.x,
    p_focus_y: focus.y,
    // У опубликованного застройщика файл сразу на сайте: без отметки правила 1.2 база откажет.
    p_rule12: readText(formData, "rule12") === "on",
  });
  if (error) return fail(contentDbErrorCode(error));
  await removeFile(guard.supabase, data);
  refresh();
  return { status: "done" };
}

/** «Удалить» у логотипа или фона; логотип опубликованного база не отдаст (vh:not_ready). */
export async function removeDeveloperMediaAction(formData: FormData): Promise<MediaActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const kind = readKind(formData);
  if (!id || !kind) return fail("invalid");

  const { data, error } = await guard.supabase.rpc("remove_developer_media", {
    p_developer: id,
    p_kind: kind,
  });
  if (error) return fail(contentDbErrorCode(error));
  await removeFile(guard.supabase, data);
  refresh();
  return { status: "done" };
}

/** Точка фокуса фона: кадры 16:9 / 4:3 / 4:5 считаются от неё (решение фазы 1, в. 4). */
export async function setDeveloperMediaFocusAction(formData: FormData): Promise<MediaActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const kind = readKind(formData);
  if (!id || !kind) return fail("invalid");

  const focus = readFocus(formData);
  const { data, error } = await guard.supabase
    .from("media_assets")
    .update({ focus_x: focus.x, focus_y: focus.y })
    .eq("developer_id", id)
    .eq("kind", kind)
    .select("id");
  if (error) return fail(contentDbErrorCode(error));
  return data?.length ? { status: "done" } : fail("notFound");
}
