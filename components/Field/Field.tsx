import type { InputHTMLAttributes, ReactNode } from "react";

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & {
  id: string;
  label: string;
  error?: string;
  /** Строка под полем: что значит пустое значение, формат. */
  hint?: string;
  /** Кнопка внутри поля справа: «показать пароль». */
  trailing?: ReactNode;
};

/** Поле формы мокапа: подпись моно-шрифтом, поле 48 px, янтарное кольцо в фокусе. */
export function Field({ id, label, error, hint, trailing, ...input }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // Ошибка заменяет подсказку: обычно она повторяет то же правило («Не короче 10 символов»).
  const showHint = Boolean(hint) && !error;
  const describedBy = [showHint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className={trailing ? "field__control field__control--with-trailing" : "field__control"}>
        <input
          id={id}
          className={error ? "field__input field__input--error" : "field__input"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...input}
        />
        {trailing ? <span className="field__trailing">{trailing}</span> : null}
      </div>
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
