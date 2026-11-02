import "server-only";
import { callSigned, hasSignedWriteEnv, visitorKey } from "@/lib/supabase/signedWrite";
import { leadDbErrorCode } from "../errors";
import type { LeadPayload } from "../request";
import type { LeadSubmitResult } from "../types";

// Заявка посетителя (PLAN §10, п. 5): подписанный вызов site_submit_lead ролью посетителя — у сайта
// нет service-ключа. Проверяет всё база (лимит частоты, снимок объекта, повтор за 24 часа); каналы
// доставки задаёт настройка leads.channels, доставляет админка (Database Webhook на новую заявку).
// Без секрета подписи сервер заявок не принимает: посетитель видит «позвоните нам», а не ложное «отправлено».

export async function submitLead(lead: LeadPayload): Promise<LeadSubmitResult> {
  if (!hasSignedWriteEnv()) return { status: "error", error: "unavailable" };
  const { data, error } = await callSigned<{ id: string; number: number; repeat_of: number | null }>(
    "site_submit_lead",
    "lead",
    { lead, client_key: await visitorKey() },
  );
  if (error || !data) {
    const code = error ? leadDbErrorCode(error) : "unknown";
    if (code !== "rateLimited") console.error("[leads] заявка не сохранилась", error?.code, error?.message);
    return { status: "error", error: code };
  }
  return { status: "sent", number: data.number, repeat: data.repeat_of !== null, id: data.id };
}
