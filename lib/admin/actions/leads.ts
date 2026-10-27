"use server";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import type { LeadActionResult, LeadCardRecord } from "@/lib/admin/leads/card";
import { deliverLeadNow, leadCardOf } from "@/lib/admin/server/leads";
import { requireActionViewer, type ActionGuard } from "@/lib/admin/session";
import { LEAD_CHANNELS, LEAD_STATUSES, type LeadChannel, type LeadStatus } from "@/lib/leads/types";

// Ведение заявок (мокап CabLeads, шторка): статус, ответственный, «Повторить» доставку. Ведут
// руководитель и менеджер (PLAN §5); права ещё раз проверяют функции базы. Ответ — свежая карточка.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Change = (supabase: SupabaseClient) => PromiseLike<{ error: PostgrestError | null }>;

/** Изменение (или только чтение) → свежая карточка заявки. */
async function withCard(guard: ActionGuard, number: number, change: Change | null): Promise<LeadActionResult> {
  if (!guard.ok) return { status: "error", error: guard.code };
  if (!Number.isSafeInteger(number) || number < 1) return { status: "error", error: "invalid" };
  const changed = change ? await change(guard.supabase) : { error: null };
  if (changed.error) return { status: "error", error: contentDbErrorCode(changed.error) };
  const card = await guard.supabase.rpc("lead_card", { p_number: number });
  if (card.error) return { status: "error", error: contentDbErrorCode(card.error) };
  return { status: "ok", card: leadCardOf(card.data as LeadCardRecord) };
}

export async function loadLeadCardAction(number: number): Promise<LeadActionResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  return withCard(guard, number, null);
}

export async function setLeadStatusAction(number: number, leadId: string, status: LeadStatus): Promise<LeadActionResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!UUID.test(leadId) || !LEAD_STATUSES.includes(status)) return { status: "error", error: "invalid" };
  return withCard(guard, number, (supabase) => supabase.rpc("set_lead_status", { p_lead: leadId, p_status: status }));
}

/** Ответственный; null — снять. «Взять в работу» — тот же вызов со своим id. */
export async function assignLeadAction(number: number, leadId: string, userId: string | null): Promise<LeadActionResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!UUID.test(leadId) || (userId !== null && !UUID.test(userId))) return { status: "error", error: "invalid" };
  return withCard(guard, number, (supabase) => supabase.rpc("assign_lead", { p_lead: leadId, p_user: userId }));
}

/**
 * «Повторить»: канал снова в очереди с нуля попыток и отправляется сразу после ответа — секретным
 * ключом, поэтому сессию проверяет сам Auth (fresh): отозванный токен с верной подписью не пройдёт.
 */
export async function retryLeadDeliveryAction(number: number, leadId: string, channel: LeadChannel): Promise<LeadActionResult> {
  const guard = await requireActionViewer(["head", "manager"], { fresh: true });
  if (!UUID.test(leadId) || !LEAD_CHANNELS.includes(channel)) return { status: "error", error: "invalid" };
  const result = await withCard(guard, number, (supabase) =>
    supabase.rpc("retry_lead_delivery", { p_lead: leadId, p_channel: channel }),
  );
  if (result.status === "ok") after(() => deliverLeadNow(leadId));
  return result;
}
