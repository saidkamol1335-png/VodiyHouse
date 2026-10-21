import {
  bilingualFrom,
  bilingualIssue,
  type BilingualIssue,
  type BilingualValue,
} from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import { readText } from "../credentials";
import { isoDateIssue } from "./mainForm";

// Вкладка «Сданные объекты» (решения Д2, Д5): форма шлёт весь список одним JSON в поле
// `projects` — порядок строк и есть порядок на сайте. Сервер проверяет каждую строку заново.

export const PROJECT_LIMITS = { nameMax: 80, maxRows: 50, yearMin: 1990, yearMax: 2100 } as const;

/** Строка в браузере: key — для React и ошибок, id — у сохранённых. */
export type ProjectDraft = {
  key: string;
  id: string | null;
  name: BilingualValue;
  plannedOn: string | null;
  deliveredOn: string | null;
};

export type ProjectRowIssue = BilingualIssue | "dateInvalid" | "contacts";
export type ProjectRowErrors = Record<
  string,
  Partial<Record<"name" | "plannedOn" | "deliveredOn", ProjectRowIssue>>
>;

/** Для save_developer_past_projects. */
export type ProjectPayload = {
  id?: string;
  name: BilingualValue;
  planned_on: string | null;
  delivered_on: string | null;
};

export type ProjectsParse =
  | { ok: true; payload: ProjectPayload[] }
  | { ok: false; error: "invalid" | "tooMany" }
  | { ok: false; error: null; rowErrors: ProjectRowErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[\w-]{1,64}$/;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDraft(raw: unknown): ProjectDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const key = asText(row.key);
  const id = row.id === null || row.id === undefined ? null : asText(row.id);
  if (!KEY.test(key) || (id !== null && !UUID.test(id))) return null;
  const name = (row.name ?? {}) as Record<string, unknown>;
  const date = (value: unknown) => asText(value) || null;
  return {
    key,
    id,
    name: { ru: asText(name.ru), uz: asText(name.uz) },
    plannedOn: date(row.plannedOn),
    deliveredOn: date(row.deliveredOn),
  };
}

function rowIssues(row: ProjectDraft): ProjectRowErrors[string] {
  const { nameMax, yearMin, yearMax } = PROJECT_LIMITS;
  const date = (value: string | null) =>
    value && isoDateIssue(value, yearMin, yearMax) ? "dateInvalid" : undefined;
  const issues = {
    name:
      bilingualIssue(row.name, { max: nameMax, required: true }) ??
      (bilingualHasContact(row.name) ? ("contacts" as const) : undefined),
    plannedOn: date(row.plannedOn),
    deliveredOn: date(row.deliveredOn),
  };
  return Object.fromEntries(Object.entries(issues).filter(([, issue]) => issue));
}

/** Разбор поля `projects`; подделанный или битый JSON — invalid. */
export function parseProjects(formData: FormData): ProjectsParse {
  let raw: unknown;
  try {
    raw = JSON.parse(readText(formData, "projects") ?? "");
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!Array.isArray(raw)) return { ok: false, error: "invalid" };
  if (raw.length > PROJECT_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  const drafts = raw.map(asDraft);
  if (drafts.some((row) => row === null)) return { ok: false, error: "invalid" };

  const rowErrors: ProjectRowErrors = {};
  for (const row of drafts as ProjectDraft[]) {
    const issues = rowIssues(row);
    if (Object.keys(issues).length > 0) rowErrors[row.key] = issues;
  }
  if (Object.keys(rowErrors).length > 0) return { ok: false, error: null, rowErrors };
  return {
    ok: true,
    payload: (drafts as ProjectDraft[]).map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      name: row.name,
      planned_on: row.plannedOn,
      delivered_on: row.deliveredOn,
    })),
  };
}

type ProjectRecord = {
  id: string;
  name: unknown;
  planned_on: string | null;
  delivered_on: string | null;
};

/** Строки из базы — в черновики формы (key = id). */
export function draftsFrom(records: readonly ProjectRecord[]): ProjectDraft[] {
  return records.map((record) => ({
    key: record.id,
    id: record.id,
    name: bilingualFrom(record.name),
    plannedOn: record.planned_on,
    deliveredOn: record.delivered_on,
  }));
}
