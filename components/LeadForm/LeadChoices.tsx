"use client";

type LeadChoicesProps<Value extends string> = {
  name: string;
  legend: string;
  options: readonly { value: Value; label: string }[];
  value: Value | null;
  onChange: (value: Value | null) => void;
  /** Можно снять выбор повторным нажатием (время просмотра — по желанию). */
  optional?: boolean;
};

/**
 * Выбор одного варианта чипами мокапа (`.opts`, `.chip.is-on`): радиокнопки под видом чипов —
 * стрелки клавиатуры и диктор работают как у обычной группы.
 */
export function LeadChoices<Value extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  optional = false,
}: LeadChoicesProps<Value>) {
  return (
    <fieldset className="lead-form__choices">
      <legend className="lead-form__label">{legend}</legend>
      <div className="lead-form__chips">
        {options.map((option) => (
          <label key={option.value} className="lead-form__chip">
            <input
              type="radio"
              className="lead-form__radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              onClick={() => {
                if (optional && value === option.value) onChange(null);
              }}
            />
            <span className="lead-form__chip-text">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
