import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv, supabaseSecretKey } from "@/lib/supabase/env";
import { leadDbErrorCode } from "../errors";
import type { LeadPayload } from "../request";
import type { LeadSubmitResult } from "../types";
import { configuredChannels } from "./channels";
import { deliverLead } from "./deliver";

// Заявка посетителя без входа — секретным ключом: прав сотрудника нет, проверяет всё база
// (submit_lead открыт только серверу: лимит частоты, снимок объекта, повтор за 24 часа). Без
// секретного ключа сервер заявок не принимает: посетитель видит «позвоните нам», а не ложное «отправлено».

/** Адрес посетителя (Netlify — свой заголовок, иначе прокси) → хэш с секретом: сам адрес не храним. */
async function clientKey(): Promise<string | null> {
  const list = await headers();
  const ip =
    list.get("x-nf-client-connection-ip") ??
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    list.get("x-real-ip");
  if (!ip) return null;
  return createHmac("sha256", supabaseSecretKey()).update(`lead-rate:${ip}`).digest("hex");
}

export async function submitLead(lead: LeadPayload): Promise<LeadSubmitResult> {
  if (!hasSupabaseAdminEnv()) return { status: "error", error: "unavailable" };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("submit_lead", {
    p_lead: lead,
    p_channels: configuredChannels(),
    p_client_key: await clientKey(),
  });
  if (error) {
    const code = leadDbErrorCode(error);
    if (code !== "rateLimited") console.error("[leads] заявка не сохранилась", error.code, error.message);
    return { status: "error", error: code };
  }
  const saved = data as { id: string; number: number; repeat_of: number | null };
  // Доставка — после ответа посетителю: Telegram и Таблица не задерживают «Заявка отправлена».
  after(() => deliverLead(admin, saved.id));
  return { status: "sent", number: saved.number, repeat: saved.repeat_of !== null };
}
