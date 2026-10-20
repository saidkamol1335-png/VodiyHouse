import type { DbErrorLike } from "../authErrors";

// Ошибки действий «Застройщиков» и «Справочников» → коды для messages/ru.json
// (admin.developers.errors). Отказы базы — по hint 'vh:…' и коду Postgres, не по тексту.
// Без импорта SDK: модуль подключают и клиентские формы.

export const CONTENT_ERRORS = [
  "forbidden",
  "session",
  "notFound",
  "notReady",
  "invalid",
  "tooMany",
  "slugReserved",
  "duplicate",
  "statusMove",
  "confirmName",
  "network",
  "notConfigured",
  "unknown",
] as const;

export type ContentErrorCode = (typeof CONTENT_ERRORS)[number];

const BY_HINT: Record<string, ContentErrorCode> = {
  "vh:forbidden": "forbidden",
  "vh:not_found": "notFound",
  "vh:not_ready": "notReady",
  "vh:invalid": "invalid",
  "vh:slug_reserved": "slugReserved",
};

// Нарушение check или домена (пустой перевод, лишний символ) — форма такое уже не пропускает,
// значит, данные пришли в обход неё: «проверьте поля».
const BY_CODE: Record<string, ContentErrorCode> = {
  P0002: "notFound",
  "42501": "forbidden",
  "23505": "duplicate",
  "23514": "invalid",
  "22P02": "invalid",
  "22023": "invalid",
};

/** Отказ базы через PostgREST; сбой сети (fetch failed) — у ошибки нет кода Postgres. */
export function contentDbErrorCode(error: DbErrorLike & { message?: string }): ContentErrorCode {
  const byHint = BY_HINT[error.hint ?? ""];
  if (byHint) return byHint;
  const byCode = BY_CODE[error.code ?? ""];
  if (byCode) return byCode;
  return !error.code && /fetch/i.test(error.message ?? "") ? "network" : "unknown";
}
