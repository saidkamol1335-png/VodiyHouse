"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { NEW_SHOWCASE_ID, showcaseItemHref, showcaseListHref } from "@/lib/admin/nav";
import { requireActionViewer, type ActionGuard } from "@/lib/admin/session";
import { adRow, parseAd, type AdErrors, type AdFields } from "@/lib/admin/showcase/adForm";
import {
  collectionRow,
  parseCollection,
  type CollectionErrors,
  type CollectionFields,
} from "@/lib/admin/showcase/collectionForm";
import { parseSpecial, specialRow, type SpecialErrors, type SpecialFields } from "@/lib/admin/showcase/specialForm";
import {
  SHOWCASE_KINDS,
  type DeleteShowcaseResult,
  type SaveShowcaseResult,
  type ShowcaseKind,
} from "@/lib/admin/showcase/types";
import { expireShowcase } from "@/lib/cache";
import { contentSlug } from "@/lib/slug";
import { removeMediaFiles } from "@/lib/admin/server/mediaFiles";

// «Витрина» (3.16а). Каждое действие — открытый POST: первой строкой проверяет, что это
// руководитель (PLAN п. 11); права ещё раз проверяют RLS и триггеры базы (ЖК своего застройщика,
// запрет «скидка»). Новая запись — insert и переход на её страницу; правка — «Сохранено».

const TABLE: Record<ShowcaseKind, "specials" | "collections" | "ads"> = {
  special: "specials",
  collection: "collections",
  ad: "ads",
};

const SLUG_FALLBACK = "podborka";
const SLUG_TRIES = 5;

type Persisted = { id: string } | { error: ContentErrorCode };

/** insert или update одной записи; у новой — id для перехода. */
async function persist(
  supabase: SupabaseClient,
  kind: ShowcaseKind,
  id: string | null,
  row: Record<string, unknown>,
): Promise<Persisted> {
  if (id) {
    const { data, error } = await supabase.from(TABLE[kind]).update(row).eq("id", id).select("id");
    if (error) return { error: contentDbErrorCode(error) };
    return data?.length ? { id } : { error: "notFound" };
  }
  const { data, error } = await supabase.from(TABLE[kind]).insert(row).select("id").single();
  if (error) return { error: contentDbErrorCode(error) };
  return { id: (data as { id: string }).id };
}

/** id записи из формы: пусто или «novoe» — создание. */
function editedId(formData: FormData): string | null {
  const raw = readText(formData, "id");
  return raw && raw !== NEW_SHOWCASE_ID ? readUuid(formData) : null;
}

const headGuard = () => requireActionViewer(["head"]);

export async function saveSpecialAction(formData: FormData): Promise<SaveShowcaseResult<SpecialFields, SpecialErrors>> {
  const guard = await headGuard();
  const parsed = parseSpecial(formData);
  const fail = (error: ContentErrorCode): SaveShowcaseResult<SpecialFields, SpecialErrors> => ({
    status: "error",
    error,
    fieldErrors: {},
    fields: parsed.fields,
  });
  if (!guard.ok) return fail(guard.code);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  const id = editedId(formData);
  const saved = await persist(guard.supabase, "special", id, specialRow(parsed.value));
  if ("error" in saved) return fail(saved.error);
  expireShowcase();
  // Новая — на страницу записи; правка — ответ формы.
  if (!id) redirect(showcaseItemHref("special", saved.id));
  return { status: "saved", at: Date.now() };
}

export async function saveAdAction(formData: FormData): Promise<SaveShowcaseResult<AdFields, AdErrors>> {
  const guard = await headGuard();
  const parsed = parseAd(formData);
  const fail = (error: ContentErrorCode): SaveShowcaseResult<AdFields, AdErrors> => ({
    status: "error",
    error,
    fieldErrors: {},
    fields: parsed.fields,
  });
  if (!guard.ok) return fail(guard.code);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  const id = editedId(formData);
  const saved = await persist(guard.supabase, "ad", id, adRow(parsed.value));
  if ("error" in saved) return fail(saved.error);
  expireShowcase();
  if (!id) redirect(showcaseItemHref("ad", saved.id));
  return { status: "saved", at: Date.now() };
}

/** Адрес подборки — из русского названия; занятый получает -2, -3… (как у застройщиков). */
async function insertCollection(guard: ActionGuard & { ok: true }, row: Record<string, unknown>, title: string): Promise<Persisted> {
  const base = contentSlug(title, SLUG_FALLBACK);
  let saved: Persisted = { error: "duplicate" };
  for (let attempt = 1; attempt <= SLUG_TRIES; attempt += 1) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    saved = await persist(guard.supabase, "collection", null, { ...row, slug });
    if (!("error" in saved) || saved.error !== "duplicate") return saved;
  }
  return saved;
}

export async function saveCollectionAction(
  formData: FormData,
): Promise<SaveShowcaseResult<CollectionFields, CollectionErrors>> {
  const guard = await headGuard();
  const parsed = parseCollection(formData);
  const fail = (error: ContentErrorCode): SaveShowcaseResult<CollectionFields, CollectionErrors> => ({
    status: "error",
    error,
    fieldErrors: {},
    fields: parsed.fields,
  });
  if (!guard.ok) return fail(guard.code);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  const id = editedId(formData);
  const row = collectionRow(parsed.value);
  const saved = id
    ? await persist(guard.supabase, "collection", id, row)
    : await insertCollection(guard, row, parsed.value.title.ru);
  if ("error" in saved) return fail(saved.error);
  expireShowcase();
  if (!id) redirect(showcaseItemHref("collection", saved.id));
  return { status: "saved", at: Date.now() };
}

const isShowcaseKind = (value: string | null): value is ShowcaseKind =>
  (SHOWCASE_KINDS as readonly (string | null)[]).includes(value);

/** «Удалить» с подтверждением: запись, её обложка (строка — каскадом, файл — Storage API) → список. */
export async function deleteShowcaseAction(formData: FormData): Promise<DeleteShowcaseResult> {
  const guard = await headGuard();
  if (!guard.ok) return { status: "error", error: guard.code };
  const kind = readText(formData, "owner");
  const id = readUuid(formData);
  if (!isShowcaseKind(kind) || !id) return { status: "error", error: "invalid" };
  if (readText(formData, "confirm") !== "on") return { status: "error", error: "confirmName" };

  const cover = await guard.supabase.rpc("remove_showcase_media", { p_owner: kind, p_id: id });
  if (cover.error) return { status: "error", error: contentDbErrorCode(cover.error) };
  const { data, error } = await guard.supabase.from(TABLE[kind]).delete().eq("id", id).select("id");
  if (error) return { status: "error", error: contentDbErrorCode(error) };
  if (!data?.length) return { status: "error", error: "notFound" };
  await removeMediaFiles(guard.supabase, cover.data);
  expireShowcase();
  redirect(showcaseListHref(kind));
}
