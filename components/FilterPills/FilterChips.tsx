"use client";

type FilterChip<Key extends string | number> = { key: Key; label: string };

type FilterChipsProps<Key extends string | number> = {
  label: string;
  chips: readonly FilterChip<Key>[];
  /** Пусто — «все»: ни один чип не нажат. */
  value: readonly Key[];
  onChange: (next: Key[]) => void;
};

/** Чипы выбора нескольких значений (подъезды, комнаты): тот же вид, что пилюли, но с переносом. */
export function FilterChips<Key extends string | number>({
  label,
  chips,
  value,
  onChange,
}: FilterChipsProps<Key>) {
  const toggle = (key: Key) =>
    onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key]);
  return (
    <div className="filter-pills filter-pills--wrap" role="group" aria-label={label}>
      {chips.map((chip) => {
        const active = value.includes(chip.key);
        return (
          <button
            key={chip.key}
            type="button"
            className={
              active ? "filter-pills__pill filter-pills__pill--active" : "filter-pills__pill"
            }
            aria-pressed={active}
            onClick={() => toggle(chip.key)}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
