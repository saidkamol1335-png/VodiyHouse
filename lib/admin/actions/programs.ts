"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { bilingualHasContact } from "@/lib/admin/contactGuard";
import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { parseRateInput, type RateInput } from "@/lib/admin/programs/rate";
import type {
  ProgramActionResult,
  ProgramFieldErrors,
  ProgramItem,
  RateSetting,
} from "@/lib/admin/programs/types";
import { readProgramItem, readRateSetting } from "@/lib/admin/server/programs";
import { requireActionViewer } from "@/lib/admin/session";
import { expirePrograms } from "@/lib/cache";
import { fetchCbuUsdRate } from "@/lib/rates/cbu";

// «Программы оплаты» (шаг 2.4, Р2–Р6): правит руководитель (PLAN §5); роль ещё раз проверяют
// RLS и функции базы (20261024100000_payment_programs.sql). Менеджер раздел только читает.

type Failure = { status: "error"; error: ContentErrorCode | null; fieldErrors: ProgramFieldErrors };

const fail = (error: ContentErrorCode | null, fieldErrors: ProgramFieldErrors = {}): Failure => ({
  status: "error",
  error,
  fieldErrors,
});
const done = <Payload>(payload: Payload): ProgramActionResult<Payload> => ({
  status: "done",
  at: Date.now(),
  payload,
});

type DbError = { code?: string; hint?: string | null; details?: string | null; message?: string };

/** Отказ проверки программы — под полем, которое назвала база (detail). */
function dbFailure(error: DbError): Failure {
  const code = contentDbErrorCode(error);
  if (code === "invalidProgram" && error.details) return fail(code, { [error.details]: "invalid" });
  return fail(code);
}

function parseProgram(formData: FormData): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(readText(formData, "program") ?? "");
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function itemOrFail(supabase: SupabaseClient, id: unknown) {
  const item = typeof id === "string" ? await readProgramItem(supabase, id) : null;
  return item ? done(item) : fail("notFound");
}

/** Карточка целиком: без id — новая (выключена, Р4), с id — правка. */
export async function saveProgramAction(
  formData: FormData,
): Promise<ProgramActionResult<ProgramItem>> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const program = parseProgram(formData);
  if (!program) return fail("invalid");
  const conditions = program.conditions as { ru: string; uz: string } | null;
  if (bilingualHasContact(conditions)) return fail("contacts", { conditions: "contacts" });
  const { data, error } = await guard.supabase.rpc("save_payment_program", { p_program: program });
  if (error) return dbFailure(error);
  expirePrograms(typeof program.developer_id === "string" ? program.developer_id : null);
  return itemOrFail(guard.supabase, data);
}

/** Тумблер «На сайте» (В3); последнюю включённую база выключить не даст. */
export async function setProgramActiveAction(formData: FormData): Promise<ProgramActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  if (!id) return fail("invalid");
  const { error } = await guard.supabase.rpc("set_payment_program_active", {
    p_program: id,
    p_active: readText(formData, "active") === "true",
  });
  if (error) return dbFailure(error);
  expirePrograms(readUuid(formData, "developerId"));
  return done(undefined);
}

/** «Удалить» — только выключенную (Р4). */
export async function deleteProgramAction(formData: FormData): Promise<ProgramActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  if (!id) return fail("invalid");
  const { error } = await guard.supabase.rpc("delete_payment_program", { p_program: id });
  if (error) return dbFailure(error);
  expirePrograms(readUuid(formData, "developerId"));
  return done(undefined);
}

/** «Скопировать к застройщику» (Р3): копия выключена и на всех блоках. */
export async function copyProgramAction(
  formData: FormData,
): Promise<ProgramActionResult<ProgramItem>> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const developerId = readUuid(formData, "developerId");
  if (!id || !developerId) return fail("invalid");
  const { data, error } = await guard.supabase.rpc("copy_payment_program", {
    p_program: id,
    p_developer: developerId,
  });
  if (error) return dbFailure(error);
  expirePrograms(developerId);
  return itemOrFail(guard.supabase, data);
}

/** Порядок карточек стрелками: все id застройщика в новом порядке. */
export async function reorderProgramsAction(formData: FormData): Promise<ProgramActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const developerId = readUuid(formData, "developerId");
  const ids = formData.getAll("ids").filter((id): id is string => typeof id === "string");
  if (!developerId || ids.length === 0) return fail("invalid");
  const { error } = await guard.supabase.rpc("reorder_payment_programs", {
    p_developer: developerId,
    p_ids: ids,
  });
  if (error) return dbFailure(error);
  expirePrograms(developerId);
  return done(undefined);
}

/** «Условия проверены сегодня» (Р5): ответ — новая отметка. */
export async function markProgramsCheckedAction(
  formData: FormData,
): Promise<ProgramActionResult<string>> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const developerId = readUuid(formData, "developerId");
  if (!developerId) return fail("invalid");
  const { error } = await guard.supabase.rpc("mark_programs_checked", { p_developer: developerId });
  if (error) return dbFailure(error);
  expirePrograms(developerId);
  return done(new Date().toISOString());
}

/** Ручной курс (Р6): clear=1 — «Вернуть курс ЦБ»; пустое поле — ошибка, а не тихий возврат. */
export async function setManualRateAction(
  formData: FormData,
): Promise<ProgramActionResult<RateSetting>> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  const parsed: RateInput =
    readText(formData, "clear") === "1"
      ? { value: null }
      : parseRateInput(readText(formData, "rate") ?? "");
  if (parsed.issue) return fail(null, { rate: parsed.issue });
  const { error } = await guard.supabase.rpc("set_manual_exchange_rate", { p_rate: parsed.value });
  if (error) return dbFailure(error);
  expirePrograms(null);
  return done(await readRateSetting(guard.supabase));
}

/** «Обновить курс ЦБ» — тот же источник, что у команды и расписания (lib/rates/cbu.ts). */
export async function refreshCbuRateAction(): Promise<ProgramActionResult<RateSetting>> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return fail(guard.code);
  let rate;
  try {
    rate = await fetchCbuUsdRate();
  } catch {
    return fail("network");
  }
  const { error } = await guard.supabase.rpc("set_cbu_exchange_rate", {
    p_rate: rate.usdUzs,
    p_date: rate.date,
  });
  if (error) return dbFailure(error);
  expirePrograms(null);
  return done(await readRateSetting(guard.supabase));
}
