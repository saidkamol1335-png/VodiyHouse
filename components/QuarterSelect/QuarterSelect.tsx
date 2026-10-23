"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { QUARTERS, quarterEndDate, quarterOf, type QuarterNumber } from "@/lib/quarters";

type QuarterSelectProps = {
  id: string;
  /** Имя в форме: уходит последний день квартала (ISO) или пустая строка. */
  name: string;
  label: string;
  defaultValue?: string | null;
  minYear: number;
  maxYear: number;
  onChange?: (isoDate: string | null) => void;
  /** Микс с элементом блока-владельца по БЭМ: место и размер задаёт его CSS. */
  className?: string;
};

const toIso = (quarter: QuarterNumber | null, year: number | null) =>
  quarter && year ? quarterEndDate({ quarter, year }) : null;

/** Срок кварталом (решение Д5): «2 кв.» + «2021»; в базе — последний день квартала. */
export function QuarterSelect({
  id,
  name,
  label,
  defaultValue,
  minYear,
  maxYear,
  onChange,
  className,
}: QuarterSelectProps) {
  const t = useTranslations("admin.quarters");
  const { quarter, year, pickQuarter, pickYear } = useQuarterValue(defaultValue, onChange);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);
  return (
    <div
      className={["field", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      <div className="quarter-select">
        <QuarterControl id={id} label={t("quarter")} value={quarter} onPick={pickQuarter}>
          {QUARTERS.map((option) => (
            <option key={option} value={option}>
              {t("quarterOption", { quarter: option })}
            </option>
          ))}
        </QuarterControl>
        <QuarterControl label={t("year")} value={year} onPick={pickYear}>
          {years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </QuarterControl>
      </div>
      <input type="hidden" name={name} value={toIso(quarter, year) ?? ""} />
    </div>
  );
}

/** Квартал и год по отдельности; наверх — дата целиком, когда выбраны оба. */
function useQuarterValue(
  defaultValue: string | null | undefined,
  onChange: ((isoDate: string | null) => void) | undefined,
) {
  const initial = defaultValue ? quarterOf(defaultValue) : null;
  const [quarter, setQuarter] = useState<QuarterNumber | null>(initial?.quarter ?? null);
  const [year, setYear] = useState<number | null>(initial?.year ?? null);
  const pickQuarter = (value: string) => {
    const next = value ? (Number(value) as QuarterNumber) : null;
    setQuarter(next);
    onChange?.(toIso(next, year));
  };
  const pickYear = (value: string) => {
    const next = value ? Number(value) : null;
    setYear(next);
    onChange?.(toIso(quarter, next));
  };
  return { quarter, year, pickQuarter, pickYear };
}

type QuarterControlProps = {
  /** Только у квартала: на него ведёт подпись поля. */
  id?: string;
  label: string;
  value: number | null;
  onPick: (value: string) => void;
  children: ReactNode;
};

function QuarterControl({ id, label, value, onPick, children }: QuarterControlProps) {
  const t = useTranslations("admin.quarters");
  return (
    <span className="quarter-select__control">
      <select
        id={id}
        className="field__input quarter-select__select"
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => onPick(event.target.value)}
      >
        <option value="">{t("none")}</option>
        {children}
      </select>
      <ChevronDown className="quarter-select__chevron" size={16} aria-hidden="true" />
    </span>
  );
}
