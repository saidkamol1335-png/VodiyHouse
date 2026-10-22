"use client";

import { useEffect, useRef } from "react";

type UnitsCheckProps = {
  label: string;
  checked: boolean;
  /** «Часть выбрана» — у галочки шапки. */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
};

/** Галочка выбора квартиры: родной checkbox (Space, диктор) в зоне касания по размеру строки. */
export function UnitsCheck({ label, checked, indeterminate = false, onChange }: UnitsCheckProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="units-check">
      <input
        ref={input}
        type="checkbox"
        className="units-check__input"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
