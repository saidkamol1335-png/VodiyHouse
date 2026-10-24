import { CALC_HINT_SLUGS, type CalcHintSlug } from "@/lib/calc/hints";
import { bilingualHasContact } from "../contactGuard";
import {
  bilingualFrom,
  bilingualIssue,
  readBilingual,
  type BilingualIssue,
  type BilingualValue,
} from "../bilingual";
import { readText } from "../credentials";
import type { ContentErrorCode } from "../developers/errors";

// «Настройки → Справочники → Подсказки «?»» (шаг 2.8, ТЗ 4.4): набор подсказок задаёт код
// (lib/calc/hints.ts) — руководитель правит термин и пояснение на двух языках и выключает «?».
// Добавить или удалить подсказку здесь нельзя: место на экране у каждой — в коде.

export const HINT_LIMITS = { termMax: 80, textMax: 300 } as const;

export type HintItem = {
  slug: CalcHintSlug;
  term: BilingualValue;
  text: BilingualValue;
  isActive: boolean;
};

export type HintErrors = Partial<Record<"term" | "text", BilingualIssue | "contacts">>;

export type HintActionResult =
  | { status: "idle" }
  | { status: "done"; at: number }
  | { status: "error"; error: ContentErrorCode | null; fieldErrors: HintErrors };

export const HINT_IDLE: HintActionResult = { status: "idle" };

type HintRecord = { slug: string; term: unknown; text: unknown; is_active: boolean };

const isHintSlug = (slug: string | null): slug is CalcHintSlug =>
  (CALC_HINT_SLUGS as readonly string[]).includes(slug ?? "");

/** Строки справочника → подсказки в порядке кода; чужие slug — мимо. */
export function hintItemsFrom(records: readonly HintRecord[]): HintItem[] {
  return CALC_HINT_SLUGS.flatMap((slug) => {
    const record = records.find((item) => item.slug === slug);
    if (!record) return [];
    return [
      {
        slug,
        term: bilingualFrom(record.term),
        text: bilingualFrom(record.text),
        isActive: record.is_active,
      },
    ];
  });
}

export type HintParse =
  { ok: true; value: HintItem } | { ok: false; fieldErrors: HintErrors; unknown?: true };

/**
 * Поля формы: slug, term.ru, term.uz, text.ru, text.uz, active ("on"). Оба языка обязательны;
 * контактов застройщика ни в термине, ни в пояснении (правило ТЗ 1.2) — подсказку видит сайт.
 */
export function parseHint(formData: FormData): HintParse {
  const slug = readText(formData, "slug");
  if (!isHintSlug(slug)) return { ok: false, fieldErrors: {}, unknown: true };
  const term = readBilingual(formData, "term");
  const text = readBilingual(formData, "text");
  const fieldErrors: HintErrors = {};
  const termIssue = bilingualIssue(term, { max: HINT_LIMITS.termMax, required: true });
  const textIssue = bilingualIssue(text, { max: HINT_LIMITS.textMax, required: true });
  if (termIssue) fieldErrors.term = termIssue;
  else if (bilingualHasContact(term)) fieldErrors.term = "contacts";
  if (textIssue) fieldErrors.text = textIssue;
  else if (bilingualHasContact(text)) fieldErrors.text = "contacts";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: { slug, term, text, isActive: readText(formData, "active") === "on" } };
}
