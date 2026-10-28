"use server";

import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { removeMediaFiles } from "@/lib/admin/server/mediaFiles";
import { requireActionViewer } from "@/lib/admin/session";
import { SHOWCASE_KINDS, type MediaActionResult, type ShowcaseKind } from "@/lib/admin/showcase/types";
import { expireShowcase, markShowcaseStale } from "@/lib/cache";
import { clampFocus, isOwnMediaPath, type FocusPoint } from "@/lib/media";

// Обложка спецпредложения, подборки или рекламы (3.16а). Файл уже в бакете — его положил браузер
// сессией руководителя (политика Storage, папка владельца). Здесь — строка media_assets через
// set_showcase_media (с отметкой правила 1.2) и удаление старого файла через Storage API.

const MAX_SIDE = 10_000;
const BLUR_MAX = 4000;

const OWNER_COLUMN: Record<ShowcaseKind, "special_id" | "collection_id" | "ad_id"> = {
  special: "special_id",
  collection: "collection_id",
  ad: "ad_id",
};

const fail = (error: ContentErrorCode): MediaActionResult => ({ status: "error", error });

const isKind = (value: string | null): value is ShowcaseKind =>
  (SHOWCASE_KINDS as readonly (string | null)[]).includes(value);

function readOwner(formData: FormData): { kind: ShowcaseKind; id: string } | null {
  const kind = readText(formData, "owner");
  const id = readUuid(formData);
  return isKind(kind) && id ? { kind, id } : null;
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

/** Новая обложка: заменяет прежнюю одной транзакцией базы; без отметки 1.2 база откажет. */
export async function attachShowcaseMediaAction(formData: FormData): Promise<MediaActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const owner = readOwner(formData);
  const path = readText(formData, "path") ?? "";
  const width = readSide(formData, "width");
  const height = readSide(formData, "height");
  const blur = readText(formData, "blur");
  if (!owner || !width || !height || !isOwnMediaPath({ type: owner.kind, id: owner.id }, path)) return fail("invalid");
  if (blur && blur.length > BLUR_MAX) return fail("invalid");

  const focus = readFocus(formData);
  const { data, error } = await guard.supabase.rpc("set_showcase_media", {
    p_owner: owner.kind,
    p_id: owner.id,
    p_path: path,
    p_width: width,
    p_height: height,
    p_blur: blur || null,
    p_focus_x: focus.x,
    p_focus_y: focus.y,
    p_rule12: readText(formData, "rule12") === "on",
  });
  if (error) return fail(contentDbErrorCode(error));
  await removeMediaFiles(guard.supabase, data);
  expireShowcase();
  return { status: "done" };
}

export async function removeShowcaseMediaAction(formData: FormData): Promise<MediaActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const owner = readOwner(formData);
  if (!owner) return fail("invalid");

  const { data, error } = await guard.supabase.rpc("remove_showcase_media", {
    p_owner: owner.kind,
    p_id: owner.id,
  });
  if (error) return fail(contentDbErrorCode(error));
  await removeMediaFiles(guard.supabase, data);
  expireShowcase();
  return { status: "done" };
}

/** Точка фокуса обложки: кадры считаются от неё (решение фазы 1, в. 4). */
export async function setShowcaseMediaFocusAction(formData: FormData): Promise<MediaActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const owner = readOwner(formData);
  if (!owner) return fail("invalid");

  const focus = readFocus(formData);
  const { data, error } = await guard.supabase
    .from("media_assets")
    .update({ focus_x: focus.x, focus_y: focus.y })
    .eq(OWNER_COLUMN[owner.kind], owner.id)
    .eq("kind", "cover")
    .select("id");
  if (error) return fail(contentDbErrorCode(error));
  if (!data?.length) return fail("notFound");
  markShowcaseStale();
  return { status: "done" };
}
