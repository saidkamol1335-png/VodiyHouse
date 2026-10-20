"use server";

import { redirect } from "next/navigation";
import { readText, readUuid } from "@/lib/admin/credentials";
import { DEMO_DEVELOPER_ROWS, demoDeveloper } from "@/lib/admin/developers/demo";
import { nameIssue, normalizeName, parseDeveloperMain } from "@/lib/admin/developers/mainForm";
import { parsePrivateNotes } from "@/lib/admin/developers/privateNotes";
import { parseProjects } from "@/lib/admin/developers/projects";
import { archiveConfirmed, canMove, missingForPublish } from "@/lib/admin/developers/publication";
import type {
  CreateDeveloperResult,
  SaveMainResult,
  SavePrivateResult,
  SaveProjectsResult,
  StatusResult,
} from "@/lib/admin/developers/types";
import { PUBLICATION_STATUSES, type PublicationStatus } from "@/lib/admin/publication";

// Подделка Supabase для стенда /dev/zastroyshchiki: настоящие проверки форм и правила статуса,
// без базы. DEMO не меняется — стенд показывает ответы действий (как /dev/staff).

function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("Стенд только для разработки");
}

/** Создание ведёт на черновик DEMO — у стенда нет базы, куда положить нового. */
export async function demoCreateDeveloperAction(
  formData: FormData,
): Promise<CreateDeveloperResult> {
  devOnly();
  const name = normalizeName(readText(formData, "name") ?? "");
  const issue = nameIssue(name);
  if (issue) return { status: "error", error: null, fieldErrors: { name: issue }, name };
  const draft =
    DEMO_DEVELOPER_ROWS.find((row) => row.status === "draft") ?? DEMO_DEVELOPER_ROWS[0]!;
  redirect(`/dev/zastroyshchiki/${draft.id}`);
}

export async function demoSaveMainAction(formData: FormData): Promise<SaveMainResult> {
  devOnly();
  const parsed = parseDeveloperMain(formData);
  if (!parsed.ok) {
    return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  }
  return { status: "saved", at: Date.now() };
}

const isStatus = (value: string | null): value is PublicationStatus =>
  (PUBLICATION_STATUSES as readonly (string | null)[]).includes(value);

/** Правила — как у настоящего действия; логотипов у DEMO нет, поэтому публикации их не хватает. */
export async function demoSetStatusAction(formData: FormData): Promise<StatusResult> {
  devOnly();
  const developer = demoDeveloper(readUuid(formData) ?? "");
  const to = readText(formData, "to");
  if (!developer || !isStatus(to)) return { status: "error", error: "invalid", missing: [] };
  if (!canMove(developer.status, to)) return { status: "error", error: "statusMove", missing: [] };
  if (to === "archived" && !archiveConfirmed(readText(formData, "confirm") ?? "", developer.name)) {
    return { status: "error", error: "confirmName", missing: [] };
  }
  const missing =
    to === "published"
      ? missingForPublish({ hasAbout: Boolean(developer.about), hasLogo: false })
      : [];
  if (missing.length > 0) return { status: "error", error: "notReady", missing };
  return { status: "done", to, at: Date.now() };
}

export async function demoSaveProjectsAction(formData: FormData): Promise<SaveProjectsResult> {
  devOnly();
  const parsed = parseProjects(formData);
  if (parsed.ok) return { status: "saved", at: Date.now() };
  return parsed.error
    ? { status: "error", error: parsed.error, rowErrors: {} }
    : { status: "error", error: null, rowErrors: parsed.rowErrors };
}

export async function demoSavePrivateAction(formData: FormData): Promise<SavePrivateResult> {
  devOnly();
  const parsed = parsePrivateNotes(formData);
  if (!parsed.ok) {
    return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  }
  return { status: "saved", at: Date.now() };
}
