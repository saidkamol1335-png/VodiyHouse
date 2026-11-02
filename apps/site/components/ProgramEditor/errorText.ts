import type { ProgramFieldErrors } from "@/lib/admin/programs/types";
import type { ProgramsT } from "@/components/ProgramCard/cardText";

const EDITOR_ERRORS = [
  "required",
  "number",
  "integer",
  "range",
  "order",
  "belowMin",
  "duplicate",
  "invalid",
  "contacts",
  "missingRu",
  "missingUz",
  "tooLong",
] as const;
type EditorError = (typeof EDITOR_ERRORS)[number];

const isKnown = (code: string): code is EditorError =>
  (EDITOR_ERRORS as readonly string[]).includes(code);

/** Текст ошибки поля; неизвестный код (ответ базы) — «Проверьте значение». */
export function errorText(
  errors: ProgramFieldErrors,
  field: string,
  t: ProgramsT,
): string | undefined {
  const code = errors[field];
  if (!code) return undefined;
  return t(`editor.errors.${isKnown(code) ? code : "invalid"}`);
}
