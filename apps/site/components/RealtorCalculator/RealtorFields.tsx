"use client";

import type { CSSProperties, ReactNode } from "react";
import { Field } from "@/components/Field";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { formatTyped } from "./realtorState";

// Поля риелторского калькулятора: число с единицей, кнопки быстрых значений, ползунок, $ | сум.

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  unit: string;
  hint?: string;
  error?: string;
  /** decimal — площадь, ставка; numeric — суммы. */
  decimal?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

/** Поле числа: набирается как угодно, после ухода с поля — с разрядами («600 000 000»). */
export function NumberField({ id, label, value, unit, hint, error, decimal, onChange, onBlur }: NumberFieldProps) {
  return (
    <Field
      id={id}
      label={label}
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={value}
      hint={hint}
      error={error}
      trailing={<span className="realtor-calc__unit">{unit}</span>}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        const formatted = formatTyped(value, decimal);
        if (formatted !== value) onChange(formatted);
        onBlur?.();
      }}
    />
  );
}

export type Chip = { key: string; label: string; active: boolean; onPick: () => void };

export function Chips({ label, chips }: { label: string; chips: readonly Chip[] }) {
  return (
    <div className="realtor-calc__chips" role="group" aria-label={label}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={chip.active ? "realtor-calc__chip realtor-calc__chip--active" : "realtor-calc__chip"}
          aria-pressed={chip.active}
          onClick={chip.onPick}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

type RangeProps = {
  id: string;
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

/**
 * Ползунок срока: заливка до значения (как у взноса в калькуляторе квартиры); над бегунком, пока его
 * тянут или он в фокусе с клавиатуры, — подсказка со значением (п. 49).
 */
export function Range({ id, label, valueText, value, min, max, onChange }: RangeProps) {
  const ratio = max > min ? (value - min) / (max - min) : 1;
  return (
    <div
      className="realtor-calc__range-wrap"
      style={{ "--realtor-calc-fill": `${ratio * 100}%`, "--realtor-calc-fill-ratio": ratio } as CSSProperties}
    >
      <input
        id={id}
        type="range"
        className="realtor-calc__range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="realtor-calc__bubble" aria-hidden="true">
        {valueText}
      </span>
    </div>
  );
}

type ChoiceProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
  /** Вариант формы: подписи переносятся, на телефоне цель касания 44 px. */
  form?: boolean;
};

/** Выбор из двух: $ | сум, аннуитетный | дифференцированный, сумма | площадь × цена м². */
export function Choice<T extends string>({ label, value, options, onChange, className, form }: ChoiceProps<T>) {
  return (
    <Segmented label={label} className={className} form={form}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={segmentedItemClass(option.value === value)}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </Segmented>
  );
}
