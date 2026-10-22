"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { readText, readUuid } from "@/lib/admin/credentials";
import { expireDeveloper } from "@/lib/cache";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import {
  developerMainRow,
  nameIssue,
  normalizeName,
  parseDeveloperMain,
} from "@/lib/admin/developers/mainForm";
import { parsePrivateNotes } from "@/lib/admin/developers/privateNotes";
import { parseProjects } from "@/lib/admin/developers/projects";
import {
  archiveConfirmed,
  canMove,
  missingForPublish,
  type PublishRequirement,
} from "@/lib/admin/developers/publication";
import type {
  CreateDeveloperResult,
  SaveMainResult,
  SavePrivateResult,
  SaveProjectsResult,
  StatusResult,
} from "@/lib/admin/developers/types";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { PUBLICATION_STATUSES, type PublicationStatus } from "@/lib/admin/publication";
import { requireActionViewer } from "@/lib/admin/session";
import { contentSlug } from "@/lib/slug";

// «Застройщики» (шаг 10.2). Каждое действие — открытый POST: первой строкой проверяет, что это
// руководитель (PLAN §3.11); права ещё раз проверяют RLS и функции базы. Ответ — коды ошибок,
// тексты переводит форма.

const SLUG_FALLBACK = "zastroyshchik";

const headGuard = () => requireActionViewer(["head"]);

/** «+ Добавить застройщика»: черновик с адресом из названия → его страница. */
export async function createDeveloperAction(formData: FormData): Promise<CreateDeveloperResult> {
  const guard = await headGuard();
  const name = normalizeName(readText(formData, "name") ?? "");
  const fail = (error: ContentErrorCode): CreateDeveloperResult => ({
    status: "error",
    error,
    fieldErrors: {},
    name,
  });
  if (!guard.ok) return fail(guard.code);
  const issue = nameIssue(name);
  if (issue) return { status: "error", error: null, fieldErrors: { name: issue }, name };

  const { data, error } = await guard.supabase.rpc("create_developer", {
    p_name: name,
    p_slug: contentSlug(name, SLUG_FALLBACK),
  });
  if (error) return fail(contentDbErrorCode(error));
  if (typeof data !== "string") return fail("unknown");
  redirect(`${ADMIN_ROUTES.developers}/${data}`);
}

/** «Сохранить вкладку» на «Основном». */
export async function saveDeveloperMainAction(formData: FormData): Promise<SaveMainResult> {
  const guard = await headGuard();
  const parsed = parseDeveloperMain(formData);
  const fail = (error: ContentErrorCode): SaveMainResult => ({
    status: "error",
    error,
    fieldErrors: {},
    fields: parsed.fields,
  });
  if (!guard.ok) return fail(guard.code);
  if (!parsed.ok)
    return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  const id = readUuid(formData);
  if (!id) return fail("notFound");

  const { data, error } = await guard.supabase
    .from("developers")
    .update(developerMainRow(parsed.value))
    .eq("id", id)
    .select("id");
  if (error) return fail(contentDbErrorCode(error));
  if (!data?.length) return fail("notFound");
  expireDeveloper(id);
  return { status: "saved", at: Date.now() };
}

const isStatus = (value: string | null): value is PublicationStatus =>
  (PUBLICATION_STATUSES as readonly (string | null)[]).includes(value);

const statusError = (
  error: ContentErrorCode,
  missing: PublishRequirement[] = [],
): StatusResult => ({
  status: "error",
  error,
  missing,
});

/**
 * Можно ли перевести (null — можно): переход разрешён, архив подтверждён названием, для
 * публикации есть «О компании» и логотип. Базу это не заменяет — там свой триггер.
 */
async function statusMoveError(
  supabase: SupabaseClient,
  id: string,
  to: PublicationStatus,
  confirm: string,
): Promise<StatusResult | null> {
  const { data, error } = await supabase
    .from("developers")
    .select("status, name, about")
    .eq("id", id)
    .maybeSingle();
  if (error) return statusError(contentDbErrorCode(error));
  if (!data) return statusError("notFound");
  if (!isStatus(data.status) || !canMove(data.status, to)) return statusError("statusMove");
  if (to === "archived" && !archiveConfirmed(confirm, data.name)) return statusError("confirmName");
  if (to !== "published") return null;

  const logo = await supabase
    .from("media_assets")
    .select("id")
    .eq("developer_id", id)
    .eq("kind", "logo")
    .maybeSingle();
  if (logo.error) return statusError(contentDbErrorCode(logo.error));
  const missing = missingForPublish({ hasAbout: Boolean(data.about), hasLogo: Boolean(logo.data) });
  return missing.length > 0 ? statusError("notReady", missing) : null;
}

/** Опубликовать · Скрыть · В архив (с вводом названия) · Восстановить. */
export async function setDeveloperStatusAction(formData: FormData): Promise<StatusResult> {
  const guard = await headGuard();
  if (!guard.ok) return statusError(guard.code);
  const id = readUuid(formData);
  const to = readText(formData, "to");
  if (!id || !isStatus(to)) return statusError("invalid");

  // Публикация — только с отметкой правила 1.2 по логотипу и фону (И8, как у ЖК).
  if (to === "published" && readText(formData, "rule12") !== "on") return statusError("rule12");
  const refused = await statusMoveError(
    guard.supabase,
    id,
    to,
    readText(formData, "confirm") ?? "",
  );
  if (refused) return refused;
  // Отметку 1.2 база требует поставить в том же действии, что и публикацию.
  const change =
    to === "published" ? { status: to, files_checked_at: new Date().toISOString() } : { status: to };
  const { error } = await guard.supabase.from("developers").update(change).eq("id", id);
  if (error) return statusError(contentDbErrorCode(error));
  expireDeveloper(id);
  return { status: "done", to, at: Date.now() };
}

/** «Сохранить вкладку» на «Сданных объектах»: весь список одним вызовом базы. */
export async function saveDeveloperProjectsAction(formData: FormData): Promise<SaveProjectsResult> {
  const guard = await headGuard();
  const fail = (error: ContentErrorCode | null, rowErrors = {}): SaveProjectsResult => ({
    status: "error",
    error,
    rowErrors,
  });
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  if (!id) return fail("notFound");
  const parsed = parseProjects(formData);
  if (!parsed.ok) return parsed.error ? fail(parsed.error) : fail(null, parsed.rowErrors);

  const { error } = await guard.supabase.rpc("save_developer_past_projects", {
    p_developer: id,
    p_projects: parsed.payload,
  });
  if (error) return fail(contentDbErrorCode(error));
  expireDeveloper(id);
  return { status: "saved", at: Date.now() };
}

/** «Внутреннее»: контакты и заметки — одна строка developer_private на застройщика. */
export async function saveDeveloperPrivateAction(formData: FormData): Promise<SavePrivateResult> {
  const guard = await headGuard();
  const parsed = parsePrivateNotes(formData);
  const fields = parsed.ok ? parsed.value : parsed.fields;
  const fail = (error: ContentErrorCode): SavePrivateResult => ({
    status: "error",
    error,
    fieldErrors: {},
    fields,
  });
  if (!guard.ok) return fail(guard.code);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields };
  const id = readUuid(formData);
  if (!id) return fail("notFound");

  const { error } = await guard.supabase
    .from("developer_private")
    .upsert({ developer_id: id, ...parsed.value }, { onConflict: "developer_id" });
  if (error) return fail(contentDbErrorCode(error));
  refresh();
  return { status: "saved", at: Date.now() };
}
