"use server";

import { parseLeadRequest } from "./request";
import { submitLead } from "./server/submit";
import type { LeadSubmitResult } from "./types";

// Заявка с сайта (ТЗ 10): ловушка → проверка полей → сервер заявок (lib/leads/server/submit.ts).

export async function submitLeadAction(request: unknown): Promise<LeadSubmitResult> {
  const parsed = parseLeadRequest(request);
  if (!parsed.ok) return { status: "error", error: "invalid", fields: parsed.fields };
  // Бот заполнил скрытое поле: отвечаем как человеку, но ничего не сохраняем.
  if (parsed.trap) return { status: "sent", number: 0, repeat: false };
  const result = await submitLead(parsed.lead);
  // Посетителю — номер для «Заявка отправлена»; id заявки ему не нужен.
  return result.status === "sent" ? { status: "sent", number: result.number, repeat: result.repeat } : result;
}
