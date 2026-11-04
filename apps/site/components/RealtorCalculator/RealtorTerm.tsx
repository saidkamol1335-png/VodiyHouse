"use client";

import { useState } from "react";
import { REALTOR_LIMITS } from "@vh/shared/calc/realtor";
import type { RealtorInputsProps } from "./RealtorInputs";
import { Choice, Chips, NumberField, Range } from "./RealtorFields";
import { parseNumber } from "./realtorState";

// Шаг «Срок и ставка» (у рассрочки — «Срок и наценка»): срок числом, ползунком и кнопками; ставка
// банка с типом платежа или наценка застройщика.

export function TermFields({ id, state, update, t }: RealtorInputsProps) {
  const inYears = state.tab !== "installment";
  const limits = inYears ? REALTOR_LIMITS.years : REALTOR_LIMITS.months;
  const value = inYears ? state.years : state.months;
  const unit = t(inYears ? "realtor.term.unitYears" : "realtor.term.unitMonths");
  const set = (next: number) => {
    const clamped = Math.min(Math.max(Math.round(next), limits.min), limits.max);
    update(inYears ? { years: clamped } : { months: clamped });
  };
  const valueText = inYears ? t("years", { count: value }) : t("months", { count: value });
  return (
    <div className="realtor-calc__group">
      <div className="realtor-calc__term">
        <TermValue
          id={`${id}-term-value`}
          label={t(inYears ? "realtor.term.years" : "realtor.term.months")}
          unit={unit}
          value={value}
          limits={limits}
          onChange={set}
        />
        <Range
          id={`${id}-term`}
          label={t("realtor.term.slider", { unit })}
          valueText={valueText}
          value={value}
          min={limits.min}
          max={limits.max}
          onChange={set}
        />
      </div>
      <Chips
        label={t("realtor.term.presets")}
        chips={limits.presets.map((preset) => ({
          key: String(preset),
          label: inYears ? t("years", { count: preset }) : t("months", { count: preset }),
          active: preset === value,
          onPick: () => set(preset),
        }))}
      />
    </div>
  );
}

type TermValueProps = {
  id: string;
  label: string;
  unit: string;
  value: number;
  limits: { min: number; max: number };
  onChange: (value: number) => void;
};

/** Срок числом. Набор «12» идёт через «1» — ниже минимума: черновик в поле, в расчёт — число в пределах. */
function TermValue({ id, label, unit, value, limits, onChange }: TermValueProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <NumberField
      id={id}
      label={label}
      unit={unit}
      value={draft ?? String(value)}
      onChange={(text) => {
        setDraft(text);
        const typed = parseNumber(text);
        if (typed !== null && typed >= limits.min && typed <= limits.max) onChange(typed);
      }}
      onBlur={() => {
        const typed = draft === null ? null : parseNumber(draft);
        if (typed !== null) onChange(typed);
        setDraft(null);
      }}
    />
  );
}

/** Выше предела расчёт берёт предел — поле говорит об этом, а не молча считает другое. */
const above = (text: string, max: number) => (parseNumber(text) ?? 0) > max;

export function RateFields({ id, state, update, t }: RealtorInputsProps) {
  const empty = parseNumber(state.rate) === null;
  const max = REALTOR_LIMITS.ratePct.max;
  const error = empty ? t("realtor.rate.empty") : above(state.rate, max) ? t("realtor.rate.capped", { max }) : undefined;
  return (
    <div className="realtor-calc__group">
      <NumberField
        id={`${id}-rate`}
        label={t("realtor.rate.label")}
        unit={t("realtor.rate.unit")}
        decimal
        value={state.rate}
        hint={error ? undefined : t("realtor.rate.hint")}
        error={error}
        onChange={(rate) => update({ rate })}
      />
      <div className="realtor-calc__method">
        <span className="realtor-calc__label">{t("realtor.method.label")}</span>
        <Choice
          label={t("realtor.method.label")}
          value={state.method}
          options={(["annuity", "differentiated"] as const).map((method) => ({
            value: method,
            label: (
              <span className="realtor-calc__method-option">
                {t(`realtor.method.${method}`)}
                <small>{t(`realtor.method.${method}Note`)}</small>
              </span>
            ),
          }))}
          onChange={(method) => update({ method })}
          className="realtor-calc__method-choice"
          form
        />
      </div>
    </div>
  );
}

export function MarkupField({ id, state, update, t }: RealtorInputsProps) {
  const max = REALTOR_LIMITS.markupPct.max;
  const capped = above(state.markup, max);
  return (
    <NumberField
      id={`${id}-markup`}
      label={t("realtor.markup.label")}
      unit={t("realtor.markup.unit")}
      decimal
      value={state.markup}
      hint={capped ? undefined : t("realtor.markup.hint")}
      error={capped ? t("realtor.markup.capped", { max }) : undefined}
      onChange={(markup) => update({ markup })}
    />
  );
}
