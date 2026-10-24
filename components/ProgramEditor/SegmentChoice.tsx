"use client";

import { Segmented, segmentedItemClass } from "@/components/Segmented";

type SegmentChoiceProps<Value extends string> = {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
};

/** Выбор одного из двух-трёх вариантов в редакторе программы: метод, валюта, блоки, превышение. */
export function SegmentChoice<Value extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentChoiceProps<Value>) {
  return (
    <Segmented label={label} form className="program-editor__segment">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={segmentedItemClass(value === option.value)}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </Segmented>
  );
}
