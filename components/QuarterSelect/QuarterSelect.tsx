"use client";

import { useState } from "react";
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
}: QuarterSelectProps) {
  const t = useTranslations("admin.quarters");
  const initial = defaultValue ? quarterOf(defaultValue) : null;
  const [quarter, setQuarter] = useState<QuarterNumber | null>(initial?.quarter ?? null);
  const [year, setYear] = useState<number | null>(initial?.year ?? null);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);

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

  return (
    <div className="field" role="group" aria-labelledby={`${id}-label`}>
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      <div className="quarter-select">
        <span className="quarter-select__control">
          <select
            id={id}
            className="field__input quarter-select__select"
            aria-label={t("quarter")}
            value={quarter ?? ""}
            onChange={(event) => pickQuarter(event.target.value)}
          >
            <option value="">{t("none")}</option>
            {QUARTERS.map((option) => (
              <option key={option} value={option}>
                {t("quarterOption", { quarter: option })}
              </option>
            ))}
          </select>
          <ChevronDown className="quarter-select__chevron" size={16} aria-hidden="true" />
        </span>
        <span className="quarter-select__control">
          <select
            className="field__input quarter-select__select"
            aria-label={t("year")}
            value={year ?? ""}
            onChange={(event) => pickYear(event.target.value)}
          >
            <option value="">{t("none")}</option>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="quarter-select__chevron" size={16} aria-hidden="true" />
        </span>
      </div>
      <input type="hidden" name={name} value={toIso(quarter, year) ?? ""} />
    </div>
  );
}
