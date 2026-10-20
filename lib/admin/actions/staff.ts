"use server";

import { refresh } from "next/cache";
import type { StaffErrorCode } from "@/lib/admin/authErrors";
import { parseStaffInput, readStaffId, readText, type StaffFields, type StaffInput } from "@/lib/admin/credentials";
import { staffDeps } from "@/lib/admin/server/deps";
import { requireActionViewer } from "@/lib/admin/session";
import { createStaffMember } from "@/lib/admin/staff/createStaff";
import { resetStaffPassword, setStaffActive } from "@/lib/admin/staff/manageStaff";
import type { CreateStaffResult, ResetPasswordResult, StaffActionResult } from "@/lib/admin/staff/types";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";

// «Настройки → Сотрудники». Каждое действие — открытый POST: первой строкой проверяет, что
// это руководитель, и спрашивает Auth заново (fresh) — дальше работает секретный ключ.
// Пароли не логируются; в ответ уходит только новый временный — один раз.

const EMPTY_FIELDS: StaffFields = { fullName: "", email: "", role: "" };
const EMAIL_FIELD_ERRORS: readonly StaffErrorCode[] = ["emailTaken", "emailInvalid"];

async function headGuard() {
  const guard = await requireActionViewer(["head"], { fresh: true });
  if (guard.ok && !hasSupabaseAdminEnv()) return { ok: false as const, code: "notConfigured" as const };
  return guard;
}

function createError(code: StaffErrorCode, fields: StaffFields): CreateStaffResult {
  if (EMAIL_FIELD_ERRORS.includes(code)) return { status: "error", error: null, fieldErrors: { email: code }, fields };
  return { status: "error", error: code, fieldErrors: {}, fields };
}

/** «Создать и показать пароль». Принимает только FormData — прошлое состояние сюда не приходит. */
export async function createStaffAction(formData: FormData): Promise<CreateStaffResult> {
  const guard = await headGuard();
  if (!guard.ok) return createError(guard.code, EMPTY_FIELDS);
  const parsed = parseStaffInput(formData);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };

  const input: StaffInput = parsed.value;
  const outcome = await createStaffMember(staffDeps(guard.supabase), input);
  if (outcome.kind === "error") return createError(outcome.code, input);
  refresh();
  return { status: "created", member: outcome.member, password: outcome.password };
}

/** «Отключить» / «Включить»: поля id и active ("true" | "false"). */
export async function setStaffActiveAction(formData: FormData): Promise<StaffActionResult> {
  const guard = await headGuard();
  if (!guard.ok) return { status: "error", error: guard.code };
  const staffId = readStaffId(formData);
  if (!staffId) return { status: "error", error: "notFound" };

  const active = readText(formData, "active") === "true";
  const outcome = await setStaffActive(staffDeps(guard.supabase), { actorId: guard.viewer.id, staffId, active });
  refresh();
  return outcome.kind === "done" ? { status: "done" } : { status: "error", error: outcome.code };
}

/** «Новый пароль»: временный пароль показывается один раз, при входе сотрудник задаст свой. */
export async function resetStaffPasswordAction(formData: FormData): Promise<ResetPasswordResult> {
  const guard = await headGuard();
  if (!guard.ok) return { status: "error", error: guard.code };
  const staffId = readStaffId(formData);
  if (!staffId) return { status: "error", error: "notFound" };

  const outcome = await resetStaffPassword(staffDeps(guard.supabase), { actorId: guard.viewer.id, staffId });
  refresh();
  return outcome.kind === "reset" ? { status: "reset", password: outcome.password } : { status: "error", error: outcome.code };
}
