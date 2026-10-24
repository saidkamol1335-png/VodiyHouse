"use server";

import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import type { ProgramActionResult } from "@/lib/admin/programs/types";
import { requireActionViewer } from "@/lib/admin/session";

// Снимок расчёта (решение фазы 2): «Скопировать для Telegram» в «Расчёте для клиента» сохраняет,
// что посчитали и по каким условиям (условия и курс база берёт сама — save_calculation). Сайт
// не меняется — кэш не трогаем. Сохраняют руководитель и менеджер (видит свои).

function jsonObject(raw: string | null): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw ?? "");
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function saveCalculationAction(
  formData: FormData,
): Promise<ProgramActionResult<string>> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return { status: "error", error: guard.code, fieldErrors: {} };
  const program = readUuid(formData, "program");
  const input = jsonObject(readText(formData, "input"));
  const result = jsonObject(readText(formData, "result"));
  if (!program || !input || !result) return { status: "error", error: "invalid", fieldErrors: {} };
  const { data, error } = await guard.supabase.rpc("save_calculation", {
    p_program: program,
    p_unit: readUuid(formData, "unit"),
    p_input: input,
    p_result: result,
  });
  if (error) return { status: "error", error: contentDbErrorCode(error), fieldErrors: {} };
  return { status: "done", at: Date.now(), payload: String(data) };
}
