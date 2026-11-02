"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { EMPTY_BILINGUAL, type BilingualValue, type Language } from "@/lib/admin/bilingual";

export type { BilingualValue };

type BilingualFieldProps = {
  id: string;
  /** Имя в форме: значения уходят как `<name>.ru` и `<name>.uz`. */
  name: string;
  label: string;
  /** Подпись узбекского поля, как в мокапе («Izoh · UZ»); без неё — та же, что у русского. */
  uzLabel?: string;
  defaultValue?: BilingualValue;
  /** Лимит под вёрстку (PLAN 3а): поле не пускает дальше, счётчик показывает остаток. */
  maxLength?: number;
  multiline?: boolean;
  required?: boolean;
  placeholder?: Partial<BilingualValue>;
  onChange?: (value: BilingualValue) => void;
  /** Подсказка UZ из RU (создание ЖК): пока UZ не трогали, он повторяет RU латиницей. */
  mirrorUz?: (ru: string) => string;
  /** Ошибка сервера под парой полей («в тексте контакты»). */
  error?: string;
};

const LANGUAGES: readonly Language[] = ["ru", "uz"];
// С 90 % лимита счётчик янтарный: пора сокращать, пока текст не упёрся в край.
const NEAR_LIMIT = 0.9;

const otherLanguage = (language: Language): Language => (language === "ru" ? "uz" : "ru");

/** Текст на двух языках (решение Д3): RU и UZ рядом, на телефоне друг под другом. */
export function BilingualField({
  defaultValue = EMPTY_BILINGUAL,
  onChange,
  mirrorUz,
  error,
  ...field
}: BilingualFieldProps) {
  const [value, setValue] = useState<BilingualValue>(defaultValue);
  const [uzTouched, setUzTouched] = useState(false);

  const change = (language: Language) => (text: string) => {
    const mirrored = language === "ru" && mirrorUz && !uzTouched;
    const next = mirrored ? { ru: text, uz: mirrorUz(text) } : { ...value, [language]: text };
    if (language === "uz") setUzTouched(true);
    setValue(next);
    onChange?.(next);
  };

  // Ошибка сервера относится к паре: оба поля ссылаются на неё и подсвечиваются, как у Field.
  const errorId = error ? `${field.id}-error` : undefined;
  return (
    <div className="bilingual-field">
      {LANGUAGES.map((language) => (
        <LanguageInput
          key={language}
          {...field}
          language={language}
          text={value[language]}
          missing={!value[language].trim() && Boolean(value[otherLanguage(language)].trim())}
          errorId={errorId}
          onText={change(language)}
        />
      ))}
      {error ? (
        <p id={errorId} className="field__error bilingual-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type LanguageInputProps = Omit<
  BilingualFieldProps,
  "defaultValue" | "onChange" | "mirrorUz" | "error"
> & {
  language: Language;
  text: string;
  missing: boolean;
  errorId?: string;
  onText: (text: string) => void;
};

function inputClassOf(multiline: boolean | undefined, missing: boolean, invalid: boolean) {
  return [
    "field__input",
    multiline ? "field__input--multiline" : null,
    missing ? "field__input--missing" : null,
    invalid ? "field__input--error" : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function LanguageInput(props: LanguageInputProps) {
  const { language, text, missing, errorId, onText, ...field } = props;
  const inputId = `${field.id}-${language}`;
  const metaId = `${inputId}-meta`;
  const label = language === "uz" ? (field.uzLabel ?? field.label) : field.label;
  const input = {
    id: inputId,
    name: `${field.name}.${language}`,
    lang: language,
    className: inputClassOf(field.multiline, missing, Boolean(errorId)),
    value: text,
    maxLength: field.maxLength,
    required: field.required,
    placeholder: field.placeholder?.[language],
    "aria-describedby": errorId ? `${metaId} ${errorId}` : metaId,
    "aria-invalid": errorId ? true : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onText(event.target.value),
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label} · {language.toUpperCase()}
      </label>
      {field.multiline ? <textarea rows={4} {...input} /> : <input type="text" {...input} />}
      <FieldMeta
        id={metaId}
        language={language}
        missing={missing}
        count={text.length}
        max={field.maxLength}
      />
    </div>
  );
}

type FieldMetaProps = {
  id: string;
  language: Language;
  missing: boolean;
  count: number;
  max?: number;
};

/** Под полем: «нужен текст на …» слева, счётчик символов справа. */
function FieldMeta({ id, language, missing, count, max }: FieldMetaProps) {
  const t = useTranslations("admin.bilingual");
  const near = max !== undefined && count >= max * NEAR_LIMIT;
  return (
    <div className="field__meta" id={id}>
      {missing ? (
        <span className="field__note--missing">
          {t(language === "uz" ? "missingUz" : "missingRu")}
        </span>
      ) : null}
      {max !== undefined ? (
        <span className={near ? "field__counter field__counter--near" : "field__counter"}>
          {t("counter", { count, max })}
        </span>
      ) : null}
    </div>
  );
}
