import { isUnitStatus, type UnitStatus } from "@/lib/units";
import type { ContentErrorCode } from "../developers/errors";
import { PUBLICATION_STATUSES, type PublicationStatus } from "../publication";
import { parseUnitsSummary, type UnitsSummary } from "./unitsSummary";

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

export type JournalCurrency = "USD" | "UZS";

export type JournalValue =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "bilingual"; ru: string; uz: string }
  | { kind: "date"; iso: string }
  | { kind: "flag"; on: boolean }
  | { kind: "status"; status: PublicationStatus }
  | { kind: "unitStatus"; status: UnitStatus }
  /** Цена квартиры: валюта блока — из самой записи (changes.currency). */
  | { kind: "money"; amount: number; currency: JournalCurrency | null; perM2: boolean }
  /** Отделка: название — из справочника; null у квартиры — «как в блоке». */
  | { kind: "finishing"; id: number | null; inherit: boolean };

/**
 * opaque — поле изменилось, но «было → стало» не показываем (файл, составной список); afterOnly —
 * только «стало»: у сводки пустое «было» значит и «было пусто», и «было по-разному».
 */
export type JournalChange = {
  field: string;
  before: JournalValue;
  after: JournalValue;
  opaque?: true;
  afterOnly?: true;
};

export type JournalEntry = {
  id: number;
  at: string;
  actor: string | null;
  action: JournalAction;
  entity: string;
  subject: string | null;
  changes: JournalChange[];
  /** Сводная запись о квартирах: сколько, номера, группы статусов. */
  summary: UnitsSummary | null;
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
  // Документ и тема деталей — в заголовке записи (journal_entries), номер справочника не нужен.
  "document_type_id",
  "topic_id",
]);
// Ссылки на файлы (чертёж, фото темы) и составные списки («Что входит в цену», «Удобство
// локации»): значения людям не прочитать, но сама правка на сайте должна быть в журнале —
// «изменено» без «было → стало».
// Фаза 4: контур блока на фасаде и картинка плана этажа — тоже «изменено» без точек и id.
const OPAQUE_FIELDS = new Set(["drawing_id", "photo_id", "price_includes", "nearby", "facade_contour", "image_id"]);
const PUBLICATION_ENTITIES = new Set(["developers", "complexes"]);
// Деньги — с валютой блока из контекста записи: цена квартиры и «цена от» планировки.
const MONEY_FIELDS: Record<string, ReadonlySet<string>> = {
  units: new Set(["price", "price_per_m2"]),
  layouts: new Set(["price_from"]),
};
const FINISHING_ENTITIES = new Set(["units", "blocks"]);
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

export type JournalValueContext = { currency: JournalCurrency | null };

const isBlank = (raw: unknown) => raw === null || raw === undefined || raw === "";

/** Значение поля в журнале: как показать «было» и «стало». */
export function journalValue(
  entity: string,
  field: string,
  raw: unknown,
  context: JournalValueContext = { currency: null },
): JournalValue {
  if (field === "finishing_id" && FINISHING_ENTITIES.has(entity))
    return isBlank(raw)
      ? { kind: "finishing", id: null, inherit: entity === "units" }
      : { kind: "finishing", id: Number(raw), inherit: false };
  if (isBlank(raw)) return { kind: "empty" };
  if (typeof raw === "boolean") return { kind: "flag", on: raw };
  if (field === "status" && PUBLICATION_ENTITIES.has(entity) && isStatus(raw))
    return { kind: "status", status: raw };
  if (entity === "units" && field === "status" && isUnitStatus(raw))
    return { kind: "unitStatus", status: raw };
  if (MONEY_FIELDS[entity]?.has(field) && typeof raw === "number")
    return {
      kind: "money",
      amount: raw,
      currency: context.currency,
      perM2: field === "price_per_m2",
    };
  if (isBilingual(raw)) return { kind: "bilingual", ru: clip(raw.ru), uz: clip(raw.uz) };
  if (typeof raw === "string" && (ISO_DATE.test(raw) || ISO_TIMESTAMP.test(raw)))
    return { kind: "date", iso: raw };
  if (typeof raw === "string" || typeof raw === "number")
    return { kind: "text", text: clip(String(raw)) };
  return { kind: "text", text: clip(JSON.stringify(raw)) };
}

const currencyOf = (changes: Record<string, unknown>): JournalCurrency | null =>
  changes.currency === "USD" || changes.currency === "UZS" ? changes.currency : null;

/** Правка — только изменённые поля {поле: [было, стало]}; добавление и удаление — без полей. */
function changesOf(record: JournalRecord, summary: UnitsSummary | null): JournalChange[] {
  if (record.action !== "update" || !record.changes || typeof record.changes !== "object")
    return [];
  const changes = record.changes as Record<string, unknown>;
  const context = { currency: currencyOf(changes) };
  return Object.entries(changes)
    .filter(
      ([field, pair]) =>
        !HIDDEN_FIELDS.has(field) &&
        Array.isArray(pair) &&
        pair.length === 2 &&
        // Смену статуса сводка показывает группами «свободна → бронь» — пара повторила бы их.
        !(summary?.kind === "status" && field === "status"),
    )
    .map(([field, pair]): JournalChange => {
      const [before, after] = pair as [unknown, unknown];
      if (OPAQUE_FIELDS.has(field))
        return { field, before: { kind: "empty" }, after: { kind: "empty" }, opaque: true };
      const change: JournalChange = {
        field,
        before: journalValue(record.entity, field, before, context),
        after: journalValue(record.entity, field, after, context),
      };
      return summary && isBlank(before) ? { ...change, afterOnly: true } : change;
    });
}

const isAction = (value: string): value is JournalAction =>
  value === "insert" || value === "update" || value === "delete";

export function journalEntries(records: readonly JournalRecord[]): JournalEntry[] {
  return (
    records
      .filter((record) => isAction(record.action))
      .map((record) => {
        const summary = record.entity === "units" ? parseUnitsSummary(record.changes) : null;
        return {
          id: Number(record.id),
          at: record.at,
          actor: record.actor_name,
          action: record.action as JournalAction,
          entity: record.entity,
          subject: record.subject,
          changes: changesOf(record, summary),
          summary,
        };
      })
      // Правка только служебных полей (новый файл фото, отметка времени) — не шум в журнале;
      // сводка квартир без пар (стояки на разные планировки) — не шум.
      .filter((entry) => entry.action !== "update" || entry.changes.length > 0 || entry.summary)
  );
}

/** Названия отделок для журнала (id → «White box»): в записи только номер справочника. */
export function finishingNames(
  items: readonly { id: number; name: { ru: string } }[],
): Record<number, string> {
  return Object.fromEntries(items.map((item) => [item.id, item.name.ru]));
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

/** Чей журнал: застройщика, ЖК или весь («Настройки → Журнал»). */
export type JournalScope = { developerId: string | null; complexId: string | null };

export const WHOLE_JOURNAL: JournalScope = { developerId: null, complexId: null };
