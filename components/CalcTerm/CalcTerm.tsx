"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CUSTOM_MONTHS_MAX, parseMonthsInput } from "@/lib/format";

export type CalcTermButton = { months: number; label: string; note: string };

export type CalcTermMessage = {
  tone: "info" | "warn";
  text: string;
  action?: { label: string; onClick: () => void };
};

export type CalcTermTexts = {
  title: string;
  custom: string;
  customNote: string;
  input: string;
  unit: string;
  less: string;
  more: string;
};

type CalcTermProps = {
  id: string;
  texts: CalcTermTexts;
  /** «17 мес.» — на какой срок посчитано. */
  valueText: string;
  buttons: readonly CalcTermButton[];
  /** null — своего срока у программы нет (банки, наценка). */
  customHint: string | null;
  /** Срок, на который посчитано, и тот, что просили (null — по умолчанию). */
  applied: number;
  requested: number | null;
  message: CalcTermMessage | null;
  onChange: (months: number) => void;
};

/**
 * Срок (мокап r1 и MobFlatTerm): кнопки сроков, «Свой» со степпером ±1 мес. и подсказкой «от 1
 * до 18 при взносе 50%»; превышение — строка под степпером (block / suggest_tier / lead).
 */
export function CalcTerm(props: CalcTermProps) {
  const { buttons, requested, customHint } = props;
  // Посчитано на сроке без кнопки (максимум ступени — 18 при 50 %): это «Свой» с этим числом.
  const shownMonths = requested ?? props.applied;
  const offered = buttons.some((button) => button.months === shownMonths);
  const [customOpen, setCustomOpen] = useState(!offered && customHint !== null);
  const custom = customHint !== null && (customOpen || !offered);
  const pick = (months: number) => {
    setCustomOpen(false);
    props.onChange(months);
  };
  return (
    <section className="calc-term" aria-labelledby={`${props.id}-title`}>
      <div className="calc-term__head">
        <h3 id={`${props.id}-title`} className="calc-term__title">
          {props.texts.title}
        </h3>
        <span className="calc-term__value">{props.valueText}</span>
      </div>
      <div className="calc-term__buttons">
        {buttons.map((button) => (
          <TermButton
            key={button.months}
            label={button.label}
            note={button.note}
            active={!custom && button.months === props.applied}
            onClick={() => pick(button.months)}
          />
        ))}
        {customHint !== null ? (
          <TermButton
            label={props.texts.custom}
            note={props.texts.customNote}
            active={custom}
            dashed
            onClick={() => setCustomOpen(true)}
          />
        ) : null}
      </div>
      {custom ? <CustomMonths {...props} hint={customHint} /> : null}
      {props.message ? <TermMessage message={props.message} /> : null}
    </section>
  );
}

type TermButtonProps = {
  label: string;
  note: string;
  active: boolean;
  dashed?: boolean;
  onClick: () => void;
};

function TermButton({ label, note, active, dashed = false, onClick }: TermButtonProps) {
  const classes = ["calc-term__button"];
  if (active) classes.push("calc-term__button--active");
  if (dashed) classes.push("calc-term__button--custom");
  return (
    <button type="button" className={classes.join(" ")} aria-pressed={active} onClick={onClick}>
      <b className="calc-term__button-label">{label}</b>
      <span className="calc-term__button-note">{note}</span>
    </button>
  );
}

/** Степпер своего срока: поле принимает только целые 1–600, кнопки — ±1 мес. */
function CustomMonths({
  id,
  texts,
  applied,
  requested,
  onChange,
  hint,
}: CalcTermProps & { hint: string | null }) {
  const current = requested ?? applied;
  const [text, setText] = useState(String(current));
  // Набранное показываем как есть (и пустое — пока стирают); срок сменился снаружи — его число.
  const shown = text === "" || parseMonthsInput(text) === current ? text : String(current);
  const step = (delta: number) => {
    const next = Math.min(Math.max(current + delta, 1), CUSTOM_MONTHS_MAX);
    setText(String(next));
    onChange(next);
  };
  return (
    <div className="calc-term__custom">
      <div className="calc-term__stepper">
        <StepButton label={texts.less} onClick={() => step(-1)}>
          <Minus size={18} aria-hidden="true" />
        </StepButton>
        <MonthsField
          id={`${id}-custom`}
          texts={texts}
          value={shown}
          onChange={(value) => {
            setText(value);
            const months = parseMonthsInput(value);
            if (months !== null) onChange(months);
          }}
        />
        <StepButton label={texts.more} onClick={() => step(1)}>
          <Plus size={18} aria-hidden="true" />
        </StepButton>
      </div>
      {hint ? <p className="calc-term__hint">{hint}</p> : null}
    </div>
  );
}

type MonthsFieldProps = {
  id: string;
  texts: CalcTermTexts;
  value: string;
  onChange: (value: string) => void;
};

function MonthsField({ id, texts, value, onChange }: MonthsFieldProps) {
  return (
    <label className="calc-term__field">
      <span className="sr-only">{texts.input}</span>
      <input
        id={id}
        className="calc-term__input"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="calc-term__unit" aria-hidden="true">
        {texts.unit}
      </span>
    </label>
  );
}

type StepButtonProps = { label: string; onClick: () => void; children: ReactNode };

function StepButton({ label, onClick, children }: StepButtonProps) {
  return (
    <button type="button" className="calc-term__step" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function TermMessage({ message }: { message: CalcTermMessage }) {
  return (
    <div className={`calc-term__message calc-term__message--${message.tone}`} role="status">
      <p>{message.text}</p>
      {message.action ? (
        <button type="button" className="calc-term__action" onClick={message.action.onClick}>
          {message.action.label}
        </button>
      ) : null}
    </div>
  );
}
