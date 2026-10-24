import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CabinetProgramRecord } from "@/lib/calc/cabinet/records";
import {
  banksFrom,
  panelsFrom,
  programItemFrom,
  rateSettingFrom,
  type PanelRecord,
} from "../programs/panels";
import type { ProgramItem, ProgramsScreenData, RateSetting } from "../programs/types";

// Чтение экрана «Программы оплаты» сессией сотрудника (RLS: руководитель и менеджер). Сбой —
// исключение: app/admin/error.tsx покажет «Кабинет временно недоступен».

export const RATE_SETTING_KEY = "exchange.usd_uzs";

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

export async function readRateSetting(supabase: SupabaseClient): Promise<RateSetting> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", RATE_SETTING_KEY)
    .maybeSingle();
  if (error) unavailable("rate", error);
  return rateSettingFrom(data?.value ?? null);
}

export async function readProgramsScreen(supabase: SupabaseClient): Promise<ProgramsScreenData> {
  const panels = await supabase.rpc("payment_program_panels");
  if (panels.error) unavailable("program-panels", panels.error);
  // И скрытые: у программы со скрытым банком в списке должен остаться её банк.
  const banks = await supabase.from("banks").select("id, name, is_active").order("sort");
  if (banks.error) unavailable("banks", banks.error);
  return {
    panels: panelsFrom((panels.data ?? []) as PanelRecord[]),
    rate: await readRateSetting(supabase),
    banks: banksFrom(banks.data ?? []),
  };
}

/** Программа после сохранения или копии — карточка обновляется ответом, не дожидаясь страницы. */
export async function readProgramItem(
  supabase: SupabaseClient,
  id: string,
): Promise<ProgramItem | null> {
  const { data, error } = await supabase
    .from("payment_programs")
    .select("*, bank:banks(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) unavailable("program", error);
  if (!data) return null;
  // Связь banks(name) приходит объектом {name}; в панелях — сразу названием.
  const { bank, ...record } = data as Omit<CabinetProgramRecord, "bank"> & {
    bank: { name: CabinetProgramRecord["bank"] } | null;
  };
  return programItemFrom({ ...record, bank: bank?.name ?? null });
}
