import type { CSSProperties } from "react";

export type CalcDownChip = {
  key: string;
  /** «50%» */
  label: string;
  /** «до 18 мес.», «сразу» */
  note: string | null;
  /** Только кабинет: «→ −6%». */
  badge: string | null;
  active: boolean;
  onPick: () => void;
};

type CalcDownProps = {
  id: string;
  title: string;
  /** «минимум 30%» */
  minText: string;
  /** «50% · $27 204» — и подпись ползунка для диктора. */
  valueText: string;
  sliderLabel: string;
  value: number;
  min: number;
  max: number;
  onChange: (pct: number) => void;
  chipsTitle: string;
  chips: readonly CalcDownChip[];
};

/**
 * Первоначальный взнос (мокап r1 и MobFlatTerm): ползунок с шагом 1 % (до 90 %, 100 % —
 * программой «100% оплата») и чипы вариантов (В5 B): ступени схемы или быстрые взносы банка.
 */
export function CalcDown(props: CalcDownProps) {
  const { id, value, min, max } = props;
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 100;
  return (
    <section className="calc-down" aria-labelledby={`${id}-title`}>
      <div className="calc-down__head">
        <h3 id={`${id}-title`} className="calc-down__title">
          {props.title} <span className="calc-down__min">· {props.minText}</span>
        </h3>
        <output htmlFor={id} className="calc-down__value">
          {props.valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="calc-down__slider"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={props.sliderLabel}
        aria-valuetext={props.valueText}
        style={{ "--calc-down-fill": `${fill}%` } as CSSProperties}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
      {props.chips.length > 0 ? <DownChips title={props.chipsTitle} chips={props.chips} /> : null}
    </section>
  );
}

function DownChips({ title, chips }: { title: string; chips: readonly CalcDownChip[] }) {
  return (
    <div className="calc-down__options" role="group" aria-label={title}>
      <p className="calc-down__options-title">{title}</p>
      <div className="calc-down__chips">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={chip.active ? "calc-down__chip calc-down__chip--active" : "calc-down__chip"}
            aria-pressed={chip.active}
            onClick={chip.onPick}
          >
            <b className="calc-down__chip-value">
              {chip.label}
              {chip.badge ? <span className="calc-down__chip-badge"> {chip.badge}</span> : null}
            </b>
            {chip.note ? <span className="calc-down__chip-note">{chip.note}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
