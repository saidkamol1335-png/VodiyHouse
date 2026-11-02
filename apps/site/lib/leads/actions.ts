"use server";

import { parseLeadRequest } from "./request";
import { submitLead } from "./server/submit";
import type { SiteLeadResult } from "./types";

// Заявка с сайта (ТЗ 10): ловушка → проверка полей → сервер заявок (lib/leads/server/submit.ts).

export async function submitLeadAction(request: unknown): Promise<SiteLeadResult> {
  const parsed = parseLeadRequest(request);
  if (!parsed.ok) return { status: "error", error: "invalid", fields: parsed.fields };
  // Бот заполнил скрытое поле: отвечаем как человеку, но ничего не сохраняем.
  if (parsed.trap) return { status: "sent", number: 0 };
  const result = await submitLead(parsed.lead);
  // Посетителю — только номер для «Заявка отправлена»: ни id, ни признака повтора.
  return result.status === "sent" ? { status: "sent", number: result.number } : result;
}
