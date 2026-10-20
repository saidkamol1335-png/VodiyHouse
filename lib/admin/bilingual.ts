import { readText } from "./credentials";

// Текст на двух языках из формы (BilingualField: `<name>.ru`, `<name>.uz`). В базе — домен
// i18n_text: либо оба языка, либо ничего (null). Половина текста — ошибка с подсказкой, где.

export type Language = "ru" | "uz";
export type BilingualValue = Record<Language, string>;
export type BilingualIssue = "required" | "missingRu" | "missingUz" | "tooLong";

export const EMPTY_BILINGUAL: BilingualValue = { ru: "", uz: "" };

/** Пробелы по краям убираются, внутри — как набрано (абзацы «О компании» сохраняются). */
export function readBilingual(formData: FormData, name: string): BilingualValue {
  return {
    ru: (readText(formData, `${name}.ru`) ?? "").trim(),
    uz: (readText(formData, `${name}.uz`) ?? "").trim(),
  };
}

/** Что не так с текстом; null — можно сохранять. */
export function bilingualIssue(
  value: BilingualValue,
  options: { max: number; required?: boolean },
): BilingualIssue | null {
  if (!value.ru && !value.uz) return options.required ? "required" : null;
  if (!value.ru) return "missingRu";
  if (!value.uz) return "missingUz";
  return value.ru.length > options.max || value.uz.length > options.max ? "tooLong" : null;
}

/** Для базы: пустой текст — null (домен i18n_text не принимает пустые строки). */
export function bilingualOrNull(value: BilingualValue): BilingualValue | null {
  return value.ru || value.uz ? value : null;
}

/** Из базы (jsonb или null) — в значение поля формы. */
export function bilingualFrom(raw: unknown): BilingualValue {
  if (!raw || typeof raw !== "object") return EMPTY_BILINGUAL;
  const { ru, uz } = raw as Partial<BilingualValue>;
  return { ru: typeof ru === "string" ? ru : "", uz: typeof uz === "string" ? uz : "" };
}
