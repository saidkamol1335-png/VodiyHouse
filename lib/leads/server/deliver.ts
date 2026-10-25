import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { siteOrigin } from "@/lib/site/metadata";
import { sendSheetRow, sendTelegram, sheetConfig, telegramConfig, type SendResult } from "./channels";
import { alertText, sheetRow, telegramText, type LeadRecord, type MessageLinks } from "../message";
import type { LeadChannel, LeadType } from "../types";

// Доставка заявки (ТЗ 10.4): сразу после заявки — с сервера (after), повторы и тревога — /api/cron.
// Итог каждой попытки пишет база (record_lead_delivery): она же решает, когда повтор и когда
// «не доставлено». Клиент — секретный ключ: функции очереди открыты только серверу.

function links(): MessageLinks {
  const site = siteOrigin();
  return { site, cabinet: `${site}${ADMIN_ROUTES.leads}` };
}

async function sendTo(channel: LeadChannel, lead: LeadRecord): Promise<SendResult> {
  if (channel === "telegram") {
    const config = telegramConfig();
    return config ? sendTelegram(config, config.chatId, telegramText(lead, links())) : { ok: false, error: "not configured" };
  }
  const config = sheetConfig();
  return config ? sendSheetRow(config, sheetRow(lead, links())) : { ok: false, error: "not configured" };
}

/** Все ждущие каналы одной заявки; ответ базы на итог не роняет остальные каналы. */
async function deliverRecord(admin: SupabaseClient, lead: LeadRecord): Promise<void> {
  await Promise.all(
    (lead.channels as LeadChannel[]).map(async (channel) => {
      const result = await sendTo(channel, lead);
      const { error } = await admin.rpc("record_lead_delivery", {
        p_lead: lead.id,
        p_channel: channel,
        p_ok: result.ok,
        p_error: result.ok ? null : result.error,
      });
      if (error) console.error("[leads] итог доставки не записан", lead.number, channel, error.message);
    }),
  );
}

/** Сразу после заявки или «Повторить» в кабинете. База отдаёт только каналы, которые этот вызов
 *  забрал (аренда 2 минуты): cron и второе нажатие ту же заявку в это время не отправят. */
export async function deliverLead(admin: SupabaseClient, leadId: string): Promise<void> {
  const { data, error } = await admin.rpc("lead_for_delivery", { p_lead: leadId });
  if (error) {
    console.error("[leads] заявка для доставки не прочиталась", error.message);
    return;
  }
  if (data) await deliverRecord(admin, data as LeadRecord);
}

/** Очередь повторов (cron): немного заявок за запуск и все сразу — прогон укладывается в лимит
 *  функции даже при тайм-аутах каналов, а чат менеджеров не упирается в лимит Telegram на группу. */
export async function deliverDue(admin: SupabaseClient, limit = 6): Promise<number> {
  const { data, error } = await admin.rpc("lead_deliveries_due", { p_limit: limit });
  if (error) throw new Error("lead-queue-unavailable", { cause: error });
  const due = (data ?? []) as LeadRecord[];
  await Promise.all(due.map((lead) => deliverRecord(admin, lead)));
  return due.length;
}

/** Тревога «не дошла за 10 минут» (ТЗ 10.4) — в чат руководителя; без Telegram отправить некуда. */
export async function alertUndelivered(admin: SupabaseClient): Promise<number> {
  const config = telegramConfig();
  if (!config) return 0;
  const { data, error } = await admin.rpc("take_undelivered_leads", { p_minutes: 10 });
  if (error) throw new Error("lead-alert-unavailable", { cause: error });
  const leads = (data ?? []) as { number: number; type: LeadType }[];
  if (leads.length === 0) return 0;
  const result = await sendTelegram(config, config.alertChatId, alertText(leads, links().cabinet));
  if (!result.ok) console.error("[leads] тревога не отправлена", result.error);
  return leads.length;
}
