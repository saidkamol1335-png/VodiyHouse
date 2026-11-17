import { readUuid } from "../credentials";
import { bilingualFrom, bilingualIssue, readBilingual, type BilingualIssue, type BilingualValue } from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import type { DictionaryItem } from "../dictionaries/definitions";

// «Детали проекта» (ТЗ 7.7; правки 15.11, п. 22 — карусель «фото + подпись», как на Cian): список
// пунктов в порядке сайта — тема из справочника (одна тема может повторяться: фасад, двор, лифт…),
// текст RU | UZ и фото из галереи ЖК (без фото — пункт только текстом). Пределы — как check и
// save_complex_details в миграциях 20261025180000 и 20261117110000.

export const DETAIL_LIMITS = { textMax: 2000, maxRows: 20 } as const;

export type DetailDraft = {
  /** Ключ строки формы: id пункта в базе или новый uuid. */
  key: string;
  /** null — новый пункт. */
  id: string | null;
  topicId: number | null;
  text: BilingualValue;
  photoId: string | null;
};

export type DetailTopic = { id: number; name: BilingualValue };

export type DetailIssue = BilingualIssue | "contacts" | "photoWithoutText" | "topicMissing";
/** Ошибки по ключу строки. */
export type DetailsErrors = Record<string, DetailIssue>;
export type DetailPayload = { id: string | null; topic_id: number; text: BilingualValue; photo_id: string | null };

export type DetailsParse =
  | { ok: true; payload: DetailPayload[] }
  | { ok: false; error: "tooMany" }
  | { ok: false; error: null; errors: DetailsErrors };

export const detailField = (key: string, part: "id" | "topic" | "text" | "photo") => `detail-${key}-${part}`;

export type DetailRecord = { id: string; topic_id: number; text: unknown; photo_id: string | null };

export function newDetailDraft(): DetailDraft {
  return { key: crypto.randomUUID(), id: null, topicId: null, text: { ru: "", uz: "" }, photoId: null };
}

/** Сохранённые пункты (по sort из базы) → строки формы. */
export function detailDrafts(records: readonly DetailRecord[]): DetailDraft[] {
  return records.map((record) => ({
    key: record.id,
    id: record.id,
    topicId: Number(record.topic_id),
    text: bilingualFrom(record.text),
    photoId: record.photo_id ?? null,
  }));
}

/** Темы для выбора: включённые и те, что уже стоят в пунктах ЖК (выключенную не теряем). */
export function detailTopics(topics: readonly DictionaryItem[], records: readonly DetailRecord[]): DetailTopic[] {
  const used = new Set(records.map((record) => Number(record.topic_id)));
  return topics.filter((topic) => topic.isActive || used.has(topic.id)).map((topic) => ({ id: topic.id, name: topic.name }));
}

function detailIssue(text: BilingualValue): DetailIssue | null {
  const issue = bilingualIssue(text, { max: DETAIL_LIMITS.textMax });
  if (issue) return issue;
  return bilingualHasContact(text) ? "contacts" : null;
}

/**
 * Поля: detailKey (по строке, в порядке сайта), detail-<key>-id, detail-<key>-topic,
 * detail-<key>-text.ru|uz, detail-<key>-photo (id фото или пусто). Пустая строка не сохраняется.
 */
export function parseDetails(formData: FormData): DetailsParse {
  const rows = formData.getAll("detailKey").map(String).map((key) => ({
    key,
    id: readUuid(formData, detailField(key, "id")),
    topicId: Number(formData.get(detailField(key, "topic")) || NaN),
    text: readBilingual(formData, detailField(key, "text")),
    photo: readUuid(formData, detailField(key, "photo")),
  }));
  const errors: DetailsErrors = {};
  const payload: DetailPayload[] = [];
  for (const row of rows) {
    if (!row.text.ru && !row.text.uz) {
      // Пустой пункт не сохраняется — выбранное к нему фото пропало бы молча.
      if (row.photo) errors[row.key] = "photoWithoutText";
      continue;
    }
    const issue = Number.isInteger(row.topicId) ? detailIssue(row.text) : "topicMissing";
    if (issue) errors[row.key] = issue;
    else payload.push({ id: row.id, topic_id: row.topicId, text: row.text, photo_id: row.photo });
  }
  if (payload.length + Object.keys(errors).length > DETAIL_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  return Object.keys(errors).length > 0 ? { ok: false, error: null, errors } : { ok: true, payload };
}
