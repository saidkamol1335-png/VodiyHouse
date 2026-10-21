"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { parseBlocks } from "@/lib/admin/complexes/blocksParse";
import { parseComplexCreate } from "@/lib/admin/complexes/create";
import { parseLayouts } from "@/lib/admin/complexes/layouts";
import { complexMainRow, parseComplexMain } from "@/lib/admin/complexes/mainForm";
import {
  missingOf,
  parseReadiness,
  requirementsFromDetail,
  type ComplexRequirement,
  type ReadinessRecord,
} from "@/lib/admin/complexes/readiness";
import type {
  ComplexStatusResult,
  CreateComplexResult,
  SaveComplexMainResult,
  SaveRowsResult,
} from "@/lib/admin/complexes/types";
import { bilingualHasContact } from "@/lib/admin/contactGuard";
import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { archiveConfirmed, canMove } from "@/lib/admin/developers/publication";
import { isPublicationStatus } from "@/lib/admin/publicationFilter";
import type { PublicationStatus } from "@/lib/admin/publication";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { removeMediaFiles } from "@/lib/admin/server/mediaFiles";
import { requireActionViewer } from "@/lib/admin/session";
import { expireComplex } from "@/lib/cache";
import { contentSlug } from "@/lib/slug";

// «ЖК» (шаг 11). Каждое действие — открытый POST: первой строкой проверяет, что это
// руководитель (PLAN §3.11); права ещё раз проверяют RLS и функции базы. Ответ — коды ошибок,
// тексты переводит форма.

const SLUG_FALLBACK = "zhk";

const headGuard = () => requireActionViewer(["head"]);

/** «+ Добавить ЖК»: черновик с адресом из UZ-названия → его страница, вкладка «Основное». */
export async function createComplexAction(formData: FormData): Promise<CreateComplexResult> {
  const guard = await headGuard();
  const parsed = parseComplexCreate(formData);
  const fail = (error: ContentErrorCode | null, fieldErrors = {}): CreateComplexResult => ({
    status: "error",
    error,
    fieldErrors,
    fields: parsed.fields,
  });
  if (!guard.ok) return fail(guard.code);
  if (!parsed.ok) return fail(null, parsed.fieldErrors);
  if (bilingualHasContact(parsed.value.name)) return fail("contacts");

  const { data, error } = await guard.supabase.rpc("create_complex", {
    p_developer: parsed.value.developerId,
    p_name: parsed.value.name,
    p_slug: contentSlug(parsed.value.name.uz, SLUG_FALLBACK),
  });
  if (error) return fail(contentDbErrorCode(error));
  if (typeof data !== "string") return fail("unknown");
  redirect(`${ADMIN_ROUTES.complexes}/${data}`);
}

type DbError = { code?: string; hint?: string; message?: string; details?: string | null };

/** ЖК блока — из базы, а не из формы; не нашли — хотя бы перерисовать страницу кабинета. */
async function expireComplexOfBlock(supabase: SupabaseClient, block: string): Promise<void> {
  const { data } = await supabase.from("blocks").select("complex_id").eq("id", block).maybeSingle();
  if (data?.complex_id) expireComplex(data.complex_id);
  else refresh();
}

/** vh:not_ready несёт в detail, какие условия публикации не выполнены: «address,point». */
const brokenOf = (error: DbError): ComplexRequirement[] =>
  error.hint === "vh:not_ready" ? requirementsFromDetail(error.details) : [];

/** «Сохранить вкладку» на «Основном» (И1–И3). */
export async function saveComplexMainAction(formData: FormData): Promise<SaveComplexMainResult> {
  const guard = await headGuard();
  const parsed = parseComplexMain(formData);
  const fail = (
    error: ContentErrorCode | null,
    broken: ComplexRequirement[] = [],
  ): SaveComplexMainResult => ({
    status: "error",
    error,
    fieldErrors: parsed.ok ? {} : parsed.fieldErrors,
    fields: parsed.fields,
    broken,
  });
  if (!guard.ok) return fail(guard.code);
  if (!parsed.ok) return fail(null);
  const id = readUuid(formData);
  if (!id) return fail("notFound");

  const { data, error } = await guard.supabase
    .from("complexes")
    .update(complexMainRow(parsed.value))
    .eq("id", id)
    .select("id");
  if (error) return fail(contentDbErrorCode(error), brokenOf(error));
  if (!data?.length) return fail("notFound");
  // Пока ЖК не публиковался, адрес на сайте — по UZ-названию (база не тронет опубликованный).
  // Поля уже сохранены: при отказе повторное «Сохранить» безопасно повторит смену адреса.
  const slug = await guard.supabase.rpc("set_complex_slug", {
    p_complex: id,
    p_slug: contentSlug(parsed.value.name.uz, SLUG_FALLBACK),
  });
  expireComplex(id);
  if (slug.error) return fail(contentDbErrorCode(slug.error));
  return { status: "saved", at: Date.now() };
}

const statusError = (
  error: ContentErrorCode,
  missing: ComplexRequirement[] = [],
): ComplexStatusResult => ({
  status: "error",
  error,
  missing,
});

/**
 * Можно ли перевести (null — можно): переход разрешён, архив подтверждён названием (RU или UZ),
 * для публикации — отметка правила 1.2 и все условия PLAN 3а. Базу это не заменяет.
 */
async function statusMoveError(
  supabase: SupabaseClient,
  formData: FormData,
  id: string,
  to: PublicationStatus,
): Promise<ComplexStatusResult | null> {
  const { data, error } = await supabase
    .from("complexes")
    .select("status, name")
    .eq("id", id)
    .maybeSingle();
  if (error) return statusError(contentDbErrorCode(error));
  if (!data) return statusError("notFound");
  if (!isPublicationStatus(data.status) || !canMove(data.status, to))
    return statusError("statusMove");
  const confirm = readText(formData, "confirm") ?? "";
  const names = Object.values((data.name ?? {}) as Record<string, string>);
  if (to === "archived" && !names.some((name) => archiveConfirmed(confirm, name)))
    return statusError("confirmName");
  if (to !== "published") return null;
  if (readText(formData, "rule12") !== "on") return statusError("rule12");

  const readiness = await supabase.rpc("complex_readiness", { p_complex: id });
  if (readiness.error) return statusError(contentDbErrorCode(readiness.error));
  const missing = missingOf(parseReadiness((readiness.data ?? []) as ReadinessRecord[]));
  return missing.length > 0 ? statusError("notReady", missing) : null;
}

/** Опубликовать (с проверкой файлов по правилу 1.2, И8) · Скрыть · В архив · Восстановить. */
export async function setComplexStatusAction(formData: FormData): Promise<ComplexStatusResult> {
  const guard = await headGuard();
  if (!guard.ok) return statusError(guard.code);
  const id = readUuid(formData);
  const to = readText(formData, "to");
  if (!id || !to || !isPublicationStatus(to)) return statusError("invalid");

  const refused = await statusMoveError(guard.supabase, formData, id, to);
  if (refused) return refused;
  // Отметку 1.2 база требует поставить в том же действии, что и публикацию.
  const change =
    to === "published"
      ? { status: to, files_checked_at: new Date().toISOString() }
      : { status: to };
  const { error } = await guard.supabase.from("complexes").update(change).eq("id", id);
  if (error) return statusError(contentDbErrorCode(error), brokenOf(error));
  expireComplex(id);
  return { status: "done", to, at: Date.now() };
}

/** «Сохранить вкладку» на «Блоках» (И4): все карточки одним вызовом базы. */
export async function saveComplexBlocksAction(formData: FormData): Promise<SaveRowsResult> {
  const guard = await headGuard();
  const fail = (
    error: ContentErrorCode | null,
    extra: Partial<SaveRowsResult> = {},
  ): SaveRowsResult =>
    ({
      status: "error",
      error,
      rowErrors: {},
      broken: [],
      ...extra,
    }) as SaveRowsResult;
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  if (!id) return fail("notFound");
  const parsed = parseBlocks(formData);
  if (!parsed.ok)
    return parsed.error ? fail(parsed.error) : fail(null, { rowErrors: parsed.rowErrors });

  const { data, error } = await guard.supabase.rpc("save_complex_blocks", {
    p_complex: id,
    p_blocks: parsed.payload,
  });
  if (error) return fail(contentDbErrorCode(error), { broken: brokenOf(error) });
  // Чертежи удалённых блоков: строк уже нет — файлы убираем из бакета.
  await removeMediaFiles(guard.supabase, data);
  expireComplex(id);
  return { status: "saved", at: Date.now() };
}

/** «Сохранить вкладку» на «Планировках» (И5): планировки одного блока одним вызовом базы. */
export async function saveBlockLayoutsAction(formData: FormData): Promise<SaveRowsResult> {
  const guard = await headGuard();
  const fail = (
    error: ContentErrorCode | null,
    extra: Partial<SaveRowsResult> = {},
  ): SaveRowsResult =>
    ({ status: "error", error, rowErrors: {}, broken: [], ...extra }) as SaveRowsResult;
  if (!guard.ok) return fail(guard.code);
  const block = readUuid(formData, "block");
  if (!block) return fail("notFound");
  const parsed = parseLayouts(formData);
  if (!parsed.ok)
    return parsed.error ? fail(parsed.error) : fail(null, { rowErrors: parsed.rowErrors });

  const { data, error } = await guard.supabase.rpc("save_block_layouts", {
    p_block: block,
    p_layouts: parsed.payload,
  });
  // vh:has_units здесь — про планировку со стояками, а не про блок со списком квартир.
  const code = error ? contentDbErrorCode(error) : null;
  if (error) return fail(code === "hasUnits" ? "layoutHasUnits" : code, { broken: brokenOf(error) });
  await removeMediaFiles(guard.supabase, data);
  await expireComplexOfBlock(guard.supabase, block);
  return { status: "saved", at: Date.now() };
}
