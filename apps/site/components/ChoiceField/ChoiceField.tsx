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
  /** Управляемое значение: выбор применяет родитель (например, после «Да» в подтверждении). */
  value?: string;
  /** sm — в строке таблицы (планировки), lg — в форме (44 px, как меню телефона). */
  size?: "sm" | "lg";
  /** Микс с элементом блока-владельца по БЭМ: место и размер задаёт его CSS. */
  className?: string;
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
  value: controlled,
  size = "lg",
  className,
}: ChoiceFieldProps) {
  const [value, pick] = useChoiceValue(defaultValue, controlled, onChange);
  return (
    <div
      className={["field choice-field", className].filter(Boolean).join(" ")}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <ChoiceHead
        id={id}
        label={label}
        clearLabel={clearLabel}
        value={value}
        onClear={() => pick("")}
      />
      <ChoiceOptions name={name} options={options} size={size} value={value} onPick={pick} />
      {/* Ничего не выбрано — радио не уходит в форму: пустое значение отправляем сами. */}
      {value ? null : <input type="hidden" name={name} value="" />}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Своё значение или управляемое родителем; выбор сообщает наверх в обоих случаях. */
function useChoiceValue(
  defaultValue: string | null,
  controlled: string | undefined,
  onChange: ((value: string) => void) | undefined,
) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const pick = (next: string) => {
    if (controlled === undefined) setInner(next);
    onChange?.(next);
  };
  return [controlled ?? inner, pick] as const;
}

type ChoiceHeadProps = {
  id: string;
  label: string;
  clearLabel?: string;
  value: string;
  onClear: () => void;
};

/** «Сбросить» — на строке подписи: сегменту нужна вся ширина (на телефоне — до 4 вариантов). */
function ChoiceHead({ id, label, clearLabel, value, onClear }: ChoiceHeadProps) {
  return (
    <div className="choice-field__head">
      <span id={`${id}-label`} className="field__label">
        {label}
      </span>
      {clearLabel && value ? (
        <button
          type="button"
          className="choice-field__clear"
          onClick={(event) => {
            onClear();
            // Клик по кнопке не даёт input: без него форма не знает о правке («Уйти без сохранения?»).
            event.currentTarget.form?.dispatchEvent(new Event("input", { bubbles: true }));
          }}
        >
          <X size={12} aria-hidden="true" />
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

type ChoiceOptionsProps = {
  name: string;
  options: readonly ChoiceOption[];
  size: "sm" | "lg";
  value: string;
  onPick: (value: string) => void;
};

function ChoiceOptions({ name, options, size, value, onPick }: ChoiceOptionsProps) {
  return (
    <div className="choice-field__row">
      <div className={`segmented segmented--${size} choice-field__options`}>
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
              onChange={() => onPick(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
