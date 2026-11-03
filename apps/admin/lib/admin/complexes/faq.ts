import { bilingualFrom, bilingualIssue, readBilingual, type BilingualIssue, type BilingualValue } from "../bilingual";
import { bilingualHasContact } from "../contactGuard";

// «Частые вопросы» ЖК (вкладка «О ЖК», PLAN §10 п. 21): до 8 пар «вопрос — ответ» на двух языках.
// Пределы — как private.valid_faq в миграции 20261103120000 (тест сверяет).

export const FAQ_LIMITS = { maxRows: 8, questionMax: 160, answerMax: 600 } as const;

export type FaqDraft = { key: string; q: BilingualValue; a: BilingualValue };
export type FaqIssue = "contacts" | BilingualIssue;
export type FaqErrors = Record<string, Partial<Record<"q" | "a", FaqIssue>>>;
export type FaqPayload = { q: BilingualValue; a: BilingualValue };

export type FaqParse =
  | { ok: true; payload: FaqPayload[] }
  | { ok: false; error: "tooMany" }
  | { ok: false; error: null; errors: FaqErrors };

export const faqField = (key: string, part: "q" | "a") => `faq-${key}-${part}`;

export function newFaqDraft(): FaqDraft {
  return { key: crypto.randomUUID(), q: { ru: "", uz: "" }, a: { ru: "", uz: "" } };
}

/** Сохранённые вопросы (complexes.faq) → строки формы. */
export function faqDrafts(value: unknown): FaqDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: { q?: unknown; a?: unknown }, index) => ({
    key: `saved-${index}`,
    q: bilingualFrom(item?.q),
    a: bilingualFrom(item?.a),
  }));
}

const isBlank = (row: FaqDraft) => !row.q.ru && !row.q.uz && !row.a.ru && !row.a.uz;

function issueOf(value: BilingualValue, max: number): FaqIssue | undefined {
  const issue = bilingualIssue(value, { max, required: true });
  if (issue) return issue;
  return bilingualHasContact(value) ? "contacts" : undefined;
}

/** Поля: faqKey (по строке, в порядке на сайте), faq-<key>-q.ru|uz, faq-<key>-a.ru|uz. */
export function parseFaq(formData: FormData): FaqParse {
  const rows = formData.getAll("faqKey").map((key) => String(key)).map((key) => ({
    key,
    q: readBilingual(formData, faqField(key, "q")),
    a: readBilingual(formData, faqField(key, "a")),
  }));
  const filled = rows.filter((row) => !isBlank(row));
  if (filled.length > FAQ_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  const errors: FaqErrors = {};
  for (const row of filled) {
    const q = issueOf(row.q, FAQ_LIMITS.questionMax);
    const a = issueOf(row.a, FAQ_LIMITS.answerMax);
    if (q || a) errors[row.key] = { ...(q ? { q } : {}), ...(a ? { a } : {}) };
  }
  if (Object.keys(errors).length > 0) return { ok: false, error: null, errors };
  return { ok: true, payload: filled.map((row) => ({ q: row.q, a: row.a })) };
}
