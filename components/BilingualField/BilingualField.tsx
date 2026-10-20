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
};

const LANGUAGES: readonly Language[] = ["ru", "uz"];
// С 90 % лимита счётчик янтарный: пора сокращать, пока текст не упёрся в край.
const NEAR_LIMIT = 0.9;

const otherLanguage = (language: Language): Language => (language === "ru" ? "uz" : "ru");

/** Текст на двух языках (решение Д3): RU и UZ рядом, на телефоне друг под другом. */
export function BilingualField({
  defaultValue = EMPTY_BILINGUAL,
  onChange,
  ...field
}: BilingualFieldProps) {
  const [value, setValue] = useState<BilingualValue>(defaultValue);

  const change = (language: Language) => (text: string) => {
    const next = { ...value, [language]: text };
    setValue(next);
    onChange?.(next);
  };

  return (
    <div className="bilingual-field">
      {LANGUAGES.map((language) => (
        <LanguageInput
          key={language}
          {...field}
          language={language}
          text={value[language]}
          missing={!value[language].trim() && Boolean(value[otherLanguage(language)].trim())}
          onText={change(language)}
        />
      ))}
    </div>
  );
}

type LanguageInputProps = Omit<BilingualFieldProps, "defaultValue" | "onChange"> & {
  language: Language;
  text: string;
  missing: boolean;
  onText: (text: string) => void;
};

function LanguageInput({ language, text, missing, onText, ...field }: LanguageInputProps) {
  const inputId = `${field.id}-${language}`;
  const metaId = `${inputId}-meta`;
  const label = language === "uz" ? (field.uzLabel ?? field.label) : field.label;
  const inputClass = `field__input${field.multiline ? " field__input--multiline" : ""}${missing ? " field__input--missing" : ""}`;
  const input = {
    id: inputId,
    name: `${field.name}.${language}`,
    lang: language,
    className: inputClass,
    value: text,
    maxLength: field.maxLength,
    required: field.required,
    placeholder: field.placeholder?.[language],
    "aria-describedby": metaId,
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
