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

/** Ключ лимита частоты: хэш с секретом — ни адрес посетителя, ни номер чата не хранятся. */
export function rateKey(kind: "ip" | "tg", value: string): string {
  return createHmac("sha256", supabaseSecretKey()).update(`lead-rate:${kind}:${value}`).digest("hex");
}

/** Адрес посетителя: Netlify — свой заголовок (его ставит край сети), иначе — прокси. */
export async function visitorKey(): Promise<string | null> {
  const list = await headers();
  const ip =
    list.get("x-nf-client-connection-ip") ??
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    list.get("x-real-ip");
  return ip ? rateKey("ip", ip) : null;
}

/** Заявка сайта (ключ — адрес посетителя) или бота (ключ — его чат). */
export async function submitLead(lead: LeadPayload, clientKey?: string | null): Promise<LeadSubmitResult> {
  if (!hasSupabaseAdminEnv()) return { status: "error", error: "unavailable" };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("submit_lead", {
    p_lead: lead,
    p_channels: configuredChannels(),
    p_client_key: clientKey === undefined ? await visitorKey() : clientKey,
  });
  if (error) {
    const code = leadDbErrorCode(error);
    if (code !== "rateLimited") console.error("[leads] заявка не сохранилась", error.code, error.message);
    return { status: "error", error: code };
  }
  const saved = data as { id: string; number: number; repeat_of: number | null };
  // Доставка — после ответа посетителю: Telegram и Таблица не задерживают «Заявка отправлена».
  after(() => deliverLead(admin, saved.id));
  return { status: "sent", number: saved.number, repeat: saved.repeat_of !== null, id: saved.id };
}
