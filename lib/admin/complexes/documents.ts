import { readText } from "../credentials";
import type { BilingualValue } from "../bilingual";
import { isoDateIssue } from "../developers/mainForm";
import type { DictionaryItem } from "../dictionaries/definitions";
import { APP_TIME_ZONE } from "@/lib/format";

// Вкладка «Документы» (ТЗ 7.8, решение фазы 3 «Мастер ЖК»): строка на тип документа справочника.
// Дата проверки — документ проверен Vodiy House и виден на сайте; пустая — на сайте его нет.
// Сканы клиенту — по запросу через Vodiy House (правило 1.2), файлов во вкладке нет.

export const DOCUMENT_LIMITS = { checkedYearMin: 2000, checkedYearMax: 2100 } as const;

export type DocumentRow = {
  typeId: number;
  name: BilingualValue;
  /** «Что это значит для вас» из справочника — подсказка «?» на сайте. */
  hint: BilingualValue | null;
  checkedOn: string;
};

export type DocumentIssue = "dateInvalid" | "futureDate";
/** Ошибки по типу документа (typeId). */
export type DocumentsErrors = Record<string, DocumentIssue>;
export type DocumentPayload = { type_id: number; checked_on: string };

export type DocumentsParse = { ok: true; payload: DocumentPayload[] } | { ok: false; errors: DocumentsErrors };

export const documentField = (typeId: number) => `document-${typeId}`;

export type DocumentRecord = { document_type_id: number; checked_on: string };

/** Строки вкладки: типы справочника по порядку; выключенный тип — только если уже проверен. */
export function documentRows(types: readonly DictionaryItem[], records: readonly DocumentRecord[]): DocumentRow[] {
  const checked = new Map(records.map((record) => [Number(record.document_type_id), record.checked_on]));
  return types
    .filter((type) => type.isActive || checked.has(type.id))
    .map((type) => ({ typeId: type.id, name: type.name, hint: type.second, checkedOn: checked.get(type.id) ?? "" }));
}

/** Сегодня по Ташкенту, «2026-10-25»: проверка не может быть завтрашней. */
export function todayInTashkent(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

function documentIssue(raw: string, today: string): DocumentIssue | null {
  const { checkedYearMin, checkedYearMax } = DOCUMENT_LIMITS;
  if (isoDateIssue(raw, checkedYearMin, checkedYearMax)) return "dateInvalid";
  return raw > today ? "futureDate" : null;
}

/** Поля: documentType (по одному на строку) и document-<id> — дата проверки или пусто. */
export function parseDocuments(formData: FormData, today: string = todayInTashkent()): DocumentsParse {
  const typeIds = formData.getAll("documentType").map(Number).filter(Number.isInteger);
  const errors: DocumentsErrors = {};
  const payload: DocumentPayload[] = [];
  for (const typeId of typeIds) {
    const raw = (readText(formData, documentField(typeId)) ?? "").trim();
    if (!raw) continue;
    const issue = documentIssue(raw, today);
    if (issue) errors[typeId] = issue;
    else payload.push({ type_id: typeId, checked_on: raw });
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, payload };
}
