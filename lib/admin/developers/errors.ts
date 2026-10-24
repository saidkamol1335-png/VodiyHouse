import type { DbErrorLike } from "../authErrors";

// Ошибки действий контента кабинета — застройщики, ЖК, справочники, журнал, программы оплаты → коды для
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
  "invalidProgram",
  "lastProgram",
  "programActive",
  "invalidRate",
  "savedReload",
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
  "vh:invalid_program": "invalidProgram",
  "vh:last_program": "lastProgram",
  "vh:program_active": "programActive",
  "vh:invalid_rate": "invalidRate",
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

/** Ошибка Storage из supabase-js: status — HTTP-ответ, statusCode — код в теле. */
export type StorageErrorLike = { status?: number; statusCode?: string; message?: string };

/**
 * Отказ Storage при загрузке файла из браузера. Политика (RLS) приходит как 400 с кодом «403»
 * в теле, истёкшая сессия — «jwt expired» или текст jose `"exp" claim timestamp check failed`;
 * без статуса ответа не было — сеть. Раньше любой отказ показывался как «нет связи», и ошибку
 * настроек облака нельзя было отличить. Сессию, потерянную в браузере, различает refuseUpload.
 */
export function storageErrorCode(error: StorageErrorLike): ContentErrorCode {
  if (/jwt|"?exp"? claim/i.test(error.message ?? "")) return "session";
  const status = error.statusCode ?? (error.status ? String(error.status) : "");
  if (!status) return "network";
  if (status === "401") return "session";
  if (status === "403" || /row-level security/i.test(error.message ?? "")) return "forbidden";
  return "unknown";
}

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
