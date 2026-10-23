import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/** group — подпись группы (<optgroup>): «Города» и «Районы» у городов и районов. */
export type SelectOption = { value: string; label: string; group?: string };

function OptionList({ options }: { options: readonly SelectOption[] }) {
  const groups = [...new Set(options.map((option) => option.group))];
  const render = (option: SelectOption) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  );
  if (groups.length === 1 && groups[0] === undefined) return <>{options.map(render)}</>;
  return (
    <>
      {groups.map((group) => (
        <optgroup key={group ?? ""} label={group ?? ""}>
          {options.filter((option) => option.group === group).map(render)}
        </optgroup>
      ))}
    </>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> & {
  id: string;
  label: string;
  options: readonly SelectOption[];
  /** Пустой вариант первой строкой («Не указан»); без него значение обязательно. */
  placeholder?: string;
  error?: string;
  hint?: string;
  /** Микс с элементом блока-владельца по БЭМ: место и размер задаёт его CSS. */
  className?: string;
};

/** Список выбора в виде поля мокапа: подпись моно-шрифтом, 48 px, своя стрелка. */
export function SelectField({
  id,
  label,
  options,
  placeholder,
  error,
  hint,
  className,
  ...select
}: SelectFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const showHint = Boolean(hint) && !error;
  const describedBy = [showHint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className={["field", className].filter(Boolean).join(" ")}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <span className="select-field">
        <select
          id={id}
          className={
            error
              ? "field__input select-field__select field__input--error"
              : "field__input select-field__select"
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...select}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          <OptionList options={options} />
        </select>
        <ChevronDown className="select-field__chevron" size={16} aria-hidden="true" />
      </span>
      {showHint ? (
        <p id={hintId} className="field__meta">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
