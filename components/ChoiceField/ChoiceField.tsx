"use client";

import { X } from "lucide-react";
import { useState } from "react";

export type ChoiceOption = { value: string; label: string };

type ChoiceFieldProps = {
  id: string;
  name: string;
  label: string;
  options: readonly ChoiceOption[];
  defaultValue?: string | null;
  /** Значение можно не выбирать: пустой факт на сайте не выводится (ТЗ 7.3б). */
  clearLabel?: string;
  error?: string;
  onChange?: (value: string) => void;
};

/** Выбор из 2–4 значений одним тапом — сегментом, как RU | UZ в шапке («реши сам» шага 11). */
export function ChoiceField({
  id,
  name,
  label,
  options,
  defaultValue = null,
  clearLabel,
  error,
  onChange,
}: ChoiceFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const pick = (next: string) => {
    setValue(next);
    onChange?.(next);
  };
  return (
    <fieldset className="field choice-field" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="field__label">{label}</legend>
      <div className="choice-field__row">
        <div className="segmented segmented--lg choice-field__options">
          {options.map((option) => (
            <label
              key={option.value}
              className={
                option.value === value
                  ? "segmented__item segmented__item--active choice-field__option"
                  : "segmented__item choice-field__option"
              }
            >
              <input
                className="choice-field__input"
                type="radio"
                name={name}
                value={option.value}
                checked={option.value === value}
                onChange={() => pick(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {clearLabel && value ? (
          <button
            type="button"
            className="choice-field__clear"
            aria-label={clearLabel}
            onClick={() => pick("")}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {/* Ничего не выбрано — радио не уходит в форму: пустое значение отправляем сами. */}
      {value ? null : <input type="hidden" name={name} value="" />}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
