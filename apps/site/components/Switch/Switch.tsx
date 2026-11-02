type SwitchProps = {
  checked: boolean;
  /** Видимая подпись рядом: состояние читается не только цветом (В3). */
  label: string;
  /** Имя для диктора, если видимой подписи мало («Ipoteka Bank: на сайте»). */
  accessibleName?: string;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
};

/** Тумблер мокапа (.switch 44×26): кнопка role="switch", цель касания 44 px. */
export function Switch({
  checked,
  label,
  accessibleName,
  onChange,
  disabled,
  describedBy,
  className,
}: SwitchProps) {
  const classes = ["switch"];
  if (checked) classes.push("switch--on");
  if (className) classes.push(className);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={accessibleName}
      aria-describedby={describedBy}
      disabled={disabled}
      className={classes.join(" ")}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__track" aria-hidden="true" />
      <span className="switch__label">{label}</span>
    </button>
  );
}
