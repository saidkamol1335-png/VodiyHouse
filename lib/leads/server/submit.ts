import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CLIENT_IP_HEADER } from "@/lib/supabase/authForwarding";
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

/**
 * Адрес посетителя для лимитов — только заголовок Netlify (его ставит край сети): x-forwarded-for
 * и x-real-ip посетитель подделывает, как в authForwarding. Формат не проверяем — адрес идёт только
 * в хэш, а e2e дают каждому тесту свой «адрес». Без заголовка — null: база пропускает лимит по
 * адресу, остаются лимиты по номеру и чату.
 */
export function visitorIp(list: Pick<Headers, "get">): string | null {
  return list.get(CLIENT_IP_HEADER)?.trim() || null;
}

export async function visitorKey(): Promise<string | null> {
  const ip = visitorIp(await headers());
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
