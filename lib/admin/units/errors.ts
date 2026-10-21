// Отказы действий «Квартир» → ответ формы: код текста, поле для подсветки (detail vh:invalid) и
// чего не хватит опубликованному ЖК (detail vh:not_ready).

import { requirementsFromDetail } from "../complexes/readiness";
import { contentDbErrorCode, type ContentErrorCode } from "../developers/errors";
import { UNIT_ERROR_FIELDS, type UnitErrorField, type UnitsActionError } from "./types";

type DbError = { code?: string; hint?: string | null; message?: string; details?: string | null };

export const unitsFailure = (
  error: ContentErrorCode,
  field: UnitErrorField | null = null,
): UnitsActionError => ({
  status: "error",
  error,
  field,
  broken: [],
});

const isField = (value: string | null | undefined): value is UnitErrorField =>
  (UNIT_ERROR_FIELDS as readonly string[]).includes(value ?? "");

export function unitsDbFailure(error: DbError): UnitsActionError {
  const code = contentDbErrorCode(error);
  return {
    status: "error",
    error: code,
    field: error.hint === "vh:invalid" && isField(error.details) ? error.details : null,
    broken: error.hint === "vh:not_ready" ? requirementsFromDetail(error.details) : [],
  };
}
