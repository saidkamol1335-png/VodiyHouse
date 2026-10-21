import {
  bilingualIssue,
  readBilingual,
  type BilingualIssue,
  type BilingualValue,
} from "../bilingual";
import { readUuid } from "../credentials";
import { normalizeName } from "../developers/mainForm";

// «+ Добавить ЖК» (решение «реши сам» шага 11): застройщик и название RU | UZ (Д3) → черновик.
// Лимит названия — как check в миграции complexes (тест сверяет): под вёрстку карточки (PLAN 3а).

export const COMPLEX_NAME_MAX = 28;

export type ComplexCreateFields = { developerId: string; name: BilingualValue };
export type ComplexCreateErrors = { developerId?: "developerRequired"; name?: BilingualIssue };

export type ComplexCreateParse =
  | { ok: true; value: { developerId: string; name: BilingualValue }; fields: ComplexCreateFields }
  | { ok: false; fields: ComplexCreateFields; fieldErrors: ComplexCreateErrors };

/** Название без «ЖК» в начале: слово «ЖК» сайт добавляет сам (мокап: «ЖК Shodlik»). */
export function normalizeComplexName(raw: string): string {
  return normalizeName(raw).replace(/^(жк|jk|j\.k\.)\s+/i, "");
}

export function parseComplexCreate(formData: FormData): ComplexCreateParse {
  const raw = readBilingual(formData, "name");
  const name = { ru: normalizeComplexName(raw.ru), uz: normalizeComplexName(raw.uz) };
  const developerId = readUuid(formData, "developerId");
  const fields = { developerId: developerId ?? "", name };
  const nameIssue = bilingualIssue(name, { max: COMPLEX_NAME_MAX, required: true });
  const fieldErrors: ComplexCreateErrors = {
    ...(developerId ? {} : { developerId: "developerRequired" as const }),
    ...(nameIssue ? { name: nameIssue } : {}),
  };
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fields, fieldErrors };
  return { ok: true, fields, value: { developerId: developerId!, name } };
}
