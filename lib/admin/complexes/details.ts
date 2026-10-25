import { readUuid } from "../credentials";
import { bilingualFrom, bilingualIssue, readBilingual, type BilingualIssue, type BilingualValue } from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import type { DictionaryItem } from "../dictionaries/definitions";

// Вкладка «Детали» (ТЗ 7.7, Ф4): строка на тему справочника — текст RU | UZ и фото из галереи ЖК.
// Пустой текст — темы нет на сайте; порядок — по справочнику. Пределы — как check и
// save_complex_details в миграции 20261025180000.

export const DETAIL_LIMITS = { textMax: 2000 } as const;

export type DetailRow = {
  topicId: number;
  name: BilingualValue;
  text: BilingualValue;
  photoId: string | null;
};

export type DetailIssue = BilingualIssue | "contacts" | "photoWithoutText";
/** Ошибки по теме (topicId). */
export type DetailsErrors = Record<string, DetailIssue>;
export type DetailPayload = { topic_id: number; text: BilingualValue; photo_id: string | null };

export type DetailsParse = { ok: true; payload: DetailPayload[] } | { ok: false; errors: DetailsErrors };

export const detailField = (topicId: number, part: "text" | "photo") => `detail-${topicId}-${part}`;

export type DetailRecord = { topic_id: number; text: unknown; photo_id: string | null };

/** Строки вкладки: темы справочника по порядку; выключенная тема — только если у ЖК есть текст. */
export function detailRows(topics: readonly DictionaryItem[], records: readonly DetailRecord[]): DetailRow[] {
  const byTopic = new Map(records.map((record) => [Number(record.topic_id), record]));
  return topics
    .filter((topic) => topic.isActive || byTopic.has(topic.id))
    .map((topic) => {
      const record = byTopic.get(topic.id);
      return { topicId: topic.id, name: topic.name, text: bilingualFrom(record?.text), photoId: record?.photo_id ?? null };
    });
}

function detailIssue(text: BilingualValue): DetailIssue | null {
  const issue = bilingualIssue(text, { max: DETAIL_LIMITS.textMax });
  if (issue) return issue;
  return bilingualHasContact(text) ? "contacts" : null;
}

/** Поля: detailTopic (по одному на тему), detail-<id>-text.ru|uz, detail-<id>-photo (id фото или пусто). */
export function parseDetails(formData: FormData): DetailsParse {
  const topicIds = formData.getAll("detailTopic").map(Number).filter(Number.isInteger);
  const errors: DetailsErrors = {};
  const payload: DetailPayload[] = [];
  for (const topicId of topicIds) {
    const text = readBilingual(formData, detailField(topicId, "text"));
    const photo = readUuid(formData, detailField(topicId, "photo"));
    if (!text.ru && !text.uz) {
      // Пустая тема не сохраняется — выбранное к ней фото пропало бы молча.
      if (photo) errors[topicId] = "photoWithoutText";
      continue;
    }
    const issue = detailIssue(text);
    if (issue) errors[topicId] = issue;
    else payload.push({ topic_id: topicId, text, photo_id: photo });
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, payload };
}
