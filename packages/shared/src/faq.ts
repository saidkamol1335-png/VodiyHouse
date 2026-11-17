// «Частые вопросы» (правки 15.11, п. 7 + 23): вопросы ЖК (complexes.faq) и общие вопросы Vodiy House —
// публичная запись settings `site.faq`. Формат один: [{ q: { ru, uz }, a: { ru, uz } }].

export const SITE_FAQ_KEY = "site.faq";

export type FaqText = { ru: string; uz: string };

export type FaqItem = { q: FaqText; a: FaqText };

function textFrom(value: unknown): FaqText | null {
  if (!value || typeof value !== "object") return null;
  const { ru, uz } = value as { ru?: unknown; uz?: unknown };
  if (typeof ru !== "string" || typeof uz !== "string") return null;
  const text = { ru: ru.trim(), uz: uz.trim() };
  return text.ru && text.uz ? text : null;
}

/** Значение из базы (jsonb) → вопросы; неполная пара (нет языка или ответа) на сайт не идёт. */
export function faqItemsFrom(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: { q?: unknown; a?: unknown } | null) => {
    const q = textFrom(item?.q);
    const a = textFrom(item?.a);
    return q && a ? [{ q, a }] : [];
  });
}
