import type { DbErrorLike } from "../authErrors";

// Ошибки действий контента кабинета — застройщики, ЖК, справочники, журнал → коды для
// messages/ru.json (admin.developers.errors). Отказы базы — по hint 'vh:…' и коду Postgres, не по тексту.
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
  "hasUnits",
  "layoutHasUnits",
  "listExists",
  "noList",
  "unitsLimit",
  "unitNumberTaken",
  "unitSlotTaken",
  "wholeList",
  "timeout",
  "floorsBelowUnits",
  "rule12",
  "developerArchived",
  "galleryFull",
  "contacts",
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
  "vh:has_units": "hasUnits",
  "vh:floors_below_units": "floorsBelowUnits",
  "vh:rule12": "rule12",
  "vh:developer_archived": "developerArchived",
  "vh:too_many": "galleryFull",
  "vh:list_exists": "listExists",
  "vh:units_limit": "unitsLimit",
  "vh:unit_taken": "unitNumberTaken",
  "vh:whole_list": "wholeList",
  "vh:confirm_name": "confirmName",
};

// Тот же отказ, но о разном (detail функции базы): номер или место на этаже, нет списка блока.
const BY_HINT_DETAIL: Record<string, ContentErrorCode> = {
  "vh:unit_taken:number": "unitNumberTaken",
  "vh:unit_taken:slot": "unitSlotTaken",
  "vh:invalid:no_list": "noList",
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
  // Ссылка на уже удалённую строку (планировка, отделка) — гонка: «обновите страницу».
  "23503": "notFound",
  // Выход числа за предел колонки — данные в обход формы.
  "22003": "invalid",
  // statement_timeout роли API (8 с): большая пачка не успела.
  "57014": "timeout",
};

/** Отказ базы через PostgREST; сбой сети (fetch failed) — у ошибки нет кода Postgres. */
export function contentDbErrorCode(
  error: DbErrorLike & { message?: string; details?: string | null },
): ContentErrorCode {
  const byDetail = BY_HINT_DETAIL[`${error.hint ?? ""}:${error.details ?? ""}`];
  if (byDetail) return byDetail;
  const byHint = BY_HINT[error.hint ?? ""];
  if (byHint) return byHint;
  const byCode = BY_CODE[error.code ?? ""];
  if (byCode) return byCode;
  return !error.code && /fetch/i.test(error.message ?? "") ? "network" : "unknown";
}
