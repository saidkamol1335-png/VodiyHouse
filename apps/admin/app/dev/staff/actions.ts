"use server";

import { devOnly } from "../devOnly";
import { parseStaffInput, readStaffId, readText } from "@/lib/admin/credentials";
import { generatePassword } from "@/lib/admin/password";
import { createStaffMember, type CreateStaffDeps } from "@/lib/admin/staff/createStaff";
import { DEMO_STAFF, DEMO_VIEWER_ID } from "@/lib/admin/staff/demoStaff";
import {
  resetStaffPassword,
  setStaffActive,
  type ManageStaffDeps,
} from "@/lib/admin/staff/manageStaff";
import type {
  CreateStaffResult,
  ResetPasswordResult,
  StaffActionResult,
} from "@/lib/admin/staff/types";

// Подделка Supabase для стенда /dev/staff: настоящие ядра и проверки, без Auth и базы.
// Список DEMO не меняется — стенд показывает ответы действий.

const TAKEN_EMAILS = new Set(DEMO_STAFF.map((member) => member.email));

const demoDeps: CreateStaffDeps & ManageStaffDeps = {
  generatePassword: () => generatePassword(),
  createAuthUser: async ({ email }) =>
    TAKEN_EMAILS.has(email)
      ? { error: { code: "email_exists", status: 422 } }
      : { id: crypto.randomUUID() },
  insertProfile: async () => null,
  deleteAuthUser: async () => true,
  updateActive: async (id) => ({ rows: DEMO_STAFF.some((member) => member.id === id) ? 1 : 0 }),
  setBan: async () => true,
  requirePasswordChange: async () => null,
  setPassword: async () => true,
};

export async function demoCreateStaffAction(formData: FormData): Promise<CreateStaffResult> {
  devOnly();
  const parsed = parseStaffInput(formData);
  if (!parsed.ok)
    return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  const outcome = await createStaffMember(demoDeps, parsed.value);
  if (outcome.kind === "created")
    return { status: "created", member: outcome.member, password: outcome.password };
  const onEmail = outcome.code === "emailTaken";
  return {
    status: "error",
    error: onEmail ? null : outcome.code,
    fieldErrors: onEmail ? { email: outcome.code } : {},
    fields: parsed.value,
  };
}

export async function demoSetStaffActiveAction(formData: FormData): Promise<StaffActionResult> {
  devOnly();
  const staffId = readStaffId(formData);
  if (!staffId) return { status: "error", error: "notFound" };
  const active = readText(formData, "active") === "true";
  const outcome = await setStaffActive(demoDeps, { actorId: DEMO_VIEWER_ID, staffId, active });
  return outcome.kind === "done" ? { status: "done" } : { status: "error", error: outcome.code };
}

export async function demoResetStaffPasswordAction(
  formData: FormData,
): Promise<ResetPasswordResult> {
  devOnly();
  const staffId = readStaffId(formData);
  if (!staffId) return { status: "error", error: "notFound" };
  const outcome = await resetStaffPassword(demoDeps, { actorId: DEMO_VIEWER_ID, staffId });
  return outcome.kind === "reset"
    ? { status: "reset", password: outcome.password }
    : { status: "error", error: outcome.code };
}
