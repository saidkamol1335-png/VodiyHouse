import type { ContentErrorCode } from "../developers/errors";
import { PUBLICATION_STATUSES, type PublicationStatus } from "../publication";

// Журнал изменений для людей (ТЗ 13.1: «кто и когда поменял»): строки journal_entries() →
// записи с изменёнными полями. Подписи полей и значений переводит компонент (messages).

export type JournalAction = "insert" | "update" | "delete";

export type JournalRecord = {
  id: number | string;
  at: string;
  action: string;
  entity: string;
  entity_id: string;
  changes: unknown;
  actor_name: string | null;
  subject: string | null;
};

export type JournalValue =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "bilingual"; ru: string; uz: string }
  | { kind: "date"; iso: string }
  | { kind: "flag"; on: boolean }
  | { kind: "status"; status: PublicationStatus };

export type JournalChange = { field: string; before: JournalValue; after: JournalValue };

export type JournalEntry = {
  id: number;
  at: string;
  actor: string | null;
  action: JournalAction;
  entity: string;
  subject: string | null;
  changes: JournalChange[];
};

// Служебные поля людям ничего не говорят: ключи, пути файлов, превью, отметки времени.
const HIDDEN_FIELDS = new Set([
  "id",
  "developer_id",
  "complex_id",
  "block_id",
  "layout_id",
  "created_at",
  "updated_at",
  "archived_at",
  "blur",
  "path",
  "width",
  "height",
]);
const PUBLICATION_ENTITIES = new Set(["developers", "complexes"]);
const TEXT_LIMIT = 140;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

const isStatus = (value: unknown): value is PublicationStatus =>
  typeof value === "string" && (PUBLICATION_STATUSES as readonly string[]).includes(value);
const clip = (text: string) =>
  text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT - 1)}…` : text;

function isBilingual(value: unknown): value is { ru: string; uz: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { ru, uz } = value as Record<string, unknown>;
  return typeof ru === "string" && typeof uz === "string";
}

/** Значение поля в журнале: как показать «было» и «стало». */
export function journalValue(entity: string, field: string, raw: unknown): JournalValue {
  if (raw === null || raw === undefined || raw === "") return { kind: "empty" };
  if (typeof raw === "boolean") return { kind: "flag", on: raw };
  if (field === "status" && PUBLICATION_ENTITIES.has(entity) && isStatus(raw))
    return { kind: "status", status: raw };
  if (isBilingual(raw)) return { kind: "bilingual", ru: clip(raw.ru), uz: clip(raw.uz) };
  if (typeof raw === "string" && (ISO_DATE.test(raw) || ISO_TIMESTAMP.test(raw)))
    return { kind: "date", iso: raw };
  if (typeof raw === "string" || typeof raw === "number")
    return { kind: "text", text: clip(String(raw)) };
  return { kind: "text", text: clip(JSON.stringify(raw)) };
}

/** Правка — только изменённые поля {поле: [было, стало]}; добавление и удаление — без полей. */
function changesOf(record: JournalRecord): JournalChange[] {
  if (record.action !== "update" || !record.changes || typeof record.changes !== "object")
    return [];
  return Object.entries(record.changes as Record<string, unknown>)
    .filter(
      ([field, pair]) => !HIDDEN_FIELDS.has(field) && Array.isArray(pair) && pair.length === 2,
    )
    .map(([field, pair]) => {
      const [before, after] = pair as [unknown, unknown];
      return {
        field,
        before: journalValue(record.entity, field, before),
        after: journalValue(record.entity, field, after),
      };
    });
}

const isAction = (value: string): value is JournalAction =>
  value === "insert" || value === "update" || value === "delete";

export function journalEntries(records: readonly JournalRecord[]): JournalEntry[] {
  return (
    records
      .filter((record) => isAction(record.action))
      .map((record) => ({
        id: Number(record.id),
        at: record.at,
        actor: record.actor_name,
        action: record.action as JournalAction,
        entity: record.entity,
        subject: record.subject,
        changes: changesOf(record),
      }))
      // Правка только служебных полей (новый файл фото, отметка времени) — не шум в журнале.
      .filter((entry) => entry.action !== "update" || entry.changes.length > 0)
  );
}

export const JOURNAL_PAGE = 30;

export type JournalPage = { entries: JournalEntry[]; nextBefore: number | null };

/** Страница журнала: «Показать ещё» продолжает с последней строки базы, даже скрытой из вида. */
export function journalPage(
  records: readonly JournalRecord[],
  limit: number = JOURNAL_PAGE,
): JournalPage {
  const last = records.at(-1);
  return {
    entries: journalEntries(records),
    nextBefore: records.length >= limit && last ? Number(last.id) : null,
  };
}

/** Ответ «Показать ещё» (lib/admin/actions/journal.ts). */
export type JournalLoadResult =
  { status: "ok"; page: JournalPage } | { status: "error"; error: ContentErrorCode };
