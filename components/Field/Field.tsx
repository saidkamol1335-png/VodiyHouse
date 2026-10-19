import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & {
  id: string;
  label: string;
  error?: string;
  /** Кнопка внутри поля справа: «показать пароль». */
  trailing?: ReactNode;
};

/** Поле формы мокапа: подпись моно-шрифтом, поле 48 px, янтарное кольцо в фокусе. */
export function Field({ id, label, error, trailing, ...input }: FieldProps) {
  const errorId = `${id}-error`;
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
          aria-describedby={error ? errorId : undefined}
          {...input}
        />
        {trailing ? <span className="field__trailing">{trailing}</span> : null}
      </div>
      {error ? (
        <p id={errorId} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
