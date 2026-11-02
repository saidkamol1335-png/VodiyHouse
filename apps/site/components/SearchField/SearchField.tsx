import { Search } from "lucide-react";

type SearchFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Микс с элементом блока-владельца по БЭМ: место и размер задаёт его CSS. */
  className?: string;
  /** Микс для самого поля ввода: высота и скругление в контексте владельца. */
  inputClassName?: string;
  /** Предел длины — тот же, до которого запрос режет сервер. */
  maxLength?: number;
};

/** Поиск над списком кабинета: ищет сразу при вводе (ТЗ 8.1), подпись — для экранного диктора. */
export function SearchField({
  id,
  label,
  value,
  placeholder,
  onChange,
  className,
  inputClassName,
  maxLength,
}: SearchFieldProps) {
  return (
    <div className={["search-field", className].filter(Boolean).join(" ")}>
      <label className="search-field__label" htmlFor={id}>
        {label}
      </label>
      <Search className="search-field__icon" size={16} aria-hidden="true" />
      <input
        id={id}
        className={["field__input search-field__input", inputClassName].filter(Boolean).join(" ")}
        type="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
