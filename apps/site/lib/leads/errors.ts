import type { DbErrorLike } from "@/lib/admin/authErrors";
import type { LeadErrorCode } from "./types";

// Отказы submit_lead → коды формы сайта (messages: lead.errors). По hint 'vh:…', не по тексту.

const BY_HINT: Record<string, LeadErrorCode> = {
  "vh:rate_limited": "rateLimited",
  "vh:invalid": "invalid",
};

/** Ошибка базы через PostgREST; без кода Postgres — ответа не было (сеть). */
export function leadDbErrorCode(error: DbErrorLike & { message?: string }): LeadErrorCode {
  const byHint = BY_HINT[error.hint ?? ""];
  if (byHint) return byHint;
  if (!error.code) return "network";
  return "unknown";
}
