import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { payloadLines, subjectLine, telegramText, type LeadRecord } from "@/lib/leads/message";
import { deliverLead } from "@/lib/leads/server/deliver";
import { ADMIN_ROUTES } from "../nav";
import { siteOrigin } from "@/lib/site/metadata";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { leadCardFrom, type LeadCard, type LeadCardRecord, type LeadTexts } from "../leads/card";
import {
  LEADS_LIMIT,
  leadRowFrom,
  leadsScreenFrom,
  type LeadRow,
  type LeadRowRecord,
  type LeadsFilter,
  type LeadsScreen,
} from "../leads/screen";

// «Заявки» и «Новые заявки» на главной (шаг 3.7) — сессией сотрудника: права проверяют функции
// базы (руководитель и менеджер). Ошибка сети или базы — исключение: страница покажет «не
// прочиталось», а не пустой список.

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

export async function readLeadsScreen(supabase: SupabaseClient, filter: LeadsFilter, limit = LEADS_LIMIT): Promise<LeadsScreen> {
  const { data, error } = await supabase.rpc("leads_screen", {
    p_status: filter.status,
    p_type: filter.type,
    p_query: filter.query || null,
    p_limit: limit,
  });
  if (error) unavailable("leads-screen", error);
  return leadsScreenFrom(data as { counts: Record<string, number>; total: number; rows: LeadRowRecord[] });
}

/** Тексты карточки — те же, что в Telegram-чате менеджеров (lib/leads/message.ts). */
function leadTexts(record: LeadCardRecord): LeadTexts {
  const site = siteOrigin();
  const lead: LeadRecord = {
    ...record,
    subject: record.subject ?? {},
    source: record.source ?? {},
    payload: record.payload ?? {},
    repeat_number: record.repeat_of?.number ?? null,
    channels: [],
  };
  return {
    subject: subjectLine(lead.subject),
    details: payloadLines(lead.payload, site),
    botMessage: telegramText(lead, { site, cabinet: `${site}${ADMIN_ROUTES.leads}` }),
  };
}

export function leadCardOf(record: LeadCardRecord): LeadCard {
  return leadCardFrom(record, leadTexts(record));
}

/** Карточка по номеру; нет такой — null (номер в адресе мог быть с опечаткой). */
export async function readLeadCard(supabase: SupabaseClient, number: number): Promise<LeadCard | null> {
  const { data, error } = await supabase.rpc("lead_card", { p_number: number });
  if (error?.hint === "vh:not_found") return null;
  if (error) unavailable("lead-card", error);
  return leadCardOf(data as LeadCardRecord);
}

export type LeadsHome = { new: number; today: number; work: number; meetings: number; latest: LeadRow[] };

export async function readLeadsHome(supabase: SupabaseClient): Promise<LeadsHome> {
  const { data, error } = await supabase.rpc("leads_home");
  if (error) unavailable("leads-home", error);
  const record = data as Omit<LeadsHome, "latest"> & { latest: LeadRowRecord[] };
  return { ...record, latest: record.latest.map(leadRowFrom) };
}

/**
 * «Повторить» в карточке: канал уже снова в очереди (retry_lead_delivery сессией сотрудника) —
 * отправляем сразу, не ждём расписания. Очередь читается только секретным ключом сервера.
 */
export async function deliverLeadNow(leadId: string): Promise<void> {
  if (!hasSupabaseAdminEnv()) return;
  await deliverLead(createSupabaseAdminClient(), leadId);
}
