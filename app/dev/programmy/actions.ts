"use server";

import { devOnly } from "../devOnly";
import { bilingualHasContact } from "@/lib/admin/contactGuard";
import { readText, readUuid } from "@/lib/admin/credentials";
import { DEMO_PROGRAMS_SCREEN, DEMO_RATE } from "@/lib/admin/programs/demo";
import { programItemFrom } from "@/lib/admin/programs/panels";
import { parseRateInput } from "@/lib/admin/programs/rate";
import type { ProgramActionResult, ProgramItem, RateSetting } from "@/lib/admin/programs/types";
import type { CabinetProgramRecord } from "@/lib/calc/cabinet/records";

// Подделка Supabase для стенда /dev/programmy: ответы как у настоящих действий, без базы. DEMO не
// меняется — экран показывает ответ действия (как стенды фазы 1); правила базы проверяют тесты базы.

const demoItems = () => DEMO_PROGRAMS_SCREEN.panels.flatMap((panel) => panel.programs);
const done = <Payload>(payload: Payload): ProgramActionResult<Payload> => ({
  status: "done",
  at: Date.now(),
  payload,
});
const fail = (error: "invalid" | "notFound" | "contacts"): ProgramActionResult<never> => ({
  status: "error",
  error,
  fieldErrors: error === "contacts" ? { conditions: "contacts" } : {},
});

export async function demoSaveProgramAction(
  formData: FormData,
): Promise<ProgramActionResult<ProgramItem>> {
  devOnly();
  let program: Record<string, unknown>;
  try {
    program = JSON.parse(readText(formData, "program") ?? "") as Record<string, unknown>;
  } catch {
    return fail("invalid");
  }
  if (bilingualHasContact(program.conditions as { ru: string; uz: string } | null))
    return fail("contacts");
  const existing = demoItems().find((item) => item.id === program.id);
  const bank = DEMO_PROGRAMS_SCREEN.banks.find((option) => option.id === program.bank_id);
  const now = new Date().toISOString();
  const record = {
    ...program,
    id: existing?.id ?? crypto.randomUUID(),
    bank: bank?.name ?? null,
    is_active: existing?.isActive ?? false,
    sort: existing?.record.sort ?? 990,
    created_at: existing?.record.created_at ?? now,
    updated_at: now,
  } as unknown as CabinetProgramRecord & { bank: unknown };
  return done(programItemFrom(record));
}

export async function demoSetProgramActiveAction(formData: FormData): Promise<ProgramActionResult> {
  devOnly();
  return readUuid(formData) ? done(undefined) : fail("invalid");
}

export async function demoDeleteProgramAction(formData: FormData): Promise<ProgramActionResult> {
  devOnly();
  return readUuid(formData) ? done(undefined) : fail("invalid");
}

export async function demoCopyProgramAction(
  formData: FormData,
): Promise<ProgramActionResult<ProgramItem>> {
  devOnly();
  const source = demoItems().find((item) => item.id === readUuid(formData));
  const developerId = readUuid(formData, "developerId");
  if (!source || !developerId) return fail("notFound");
  const record = {
    ...source.record,
    id: crypto.randomUUID(),
    developer_id: developerId,
    is_active: false,
    blocks_scope: "all" as const,
    block_ids: [],
    sort: 990,
    bank: source.bankName,
  };
  return done(programItemFrom(record));
}

export async function demoReorderProgramsAction(formData: FormData): Promise<ProgramActionResult> {
  devOnly();
  return readUuid(formData, "developerId") ? done(undefined) : fail("invalid");
}

export async function demoMarkProgramsCheckedAction(
  formData: FormData,
): Promise<ProgramActionResult<string>> {
  devOnly();
  return readUuid(formData, "developerId") ? done(new Date().toISOString()) : fail("invalid");
}

export async function demoSetManualRateAction(
  formData: FormData,
): Promise<ProgramActionResult<RateSetting>> {
  devOnly();
  if (readText(formData, "clear") === "1") return done(DEMO_RATE);
  const parsed = parseRateInput(readText(formData, "rate") ?? "");
  if (parsed.value === null) {
    return { status: "error", error: null, fieldErrors: { rate: parsed.issue ?? "number" } };
  }
  const date = new Date().toISOString().slice(0, 10);
  return done({ ...DEMO_RATE, manual: { usdUzs: parsed.value, date } });
}

/** Стенд не ходит на cbu.uz: «Обновить» возвращает курс мокапа. */
export async function demoRefreshCbuRateAction(): Promise<ProgramActionResult<RateSetting>> {
  devOnly();
  return done(DEMO_RATE);
}
