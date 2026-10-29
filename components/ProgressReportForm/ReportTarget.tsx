"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { SelectField } from "@/components/SelectField";
import { readProgressUnitsAction } from "@/lib/admin/actions/progressReports";
import type { ProgressFormComplex, ProgressUnitOption } from "@/lib/admin/progress/types";
import { formatArea, formatMonthYear } from "@/lib/format";

export type ReportTargetValue = {
  complexId: string;
  month: string;
  blockId: string;
  unitId: string;
};

type ReportTargetProps = {
  complexes: readonly ProgressFormComplex[];
  months: readonly [string, string];
  value: ReportTargetValue;
  onChange: (patch: Partial<ReportTargetValue>) => void;
};

type Choice = { id: string; label: string };

/**
 * «ЖК · Месяц отчёта», «Блок» (только если строящихся блоков несколько) и «Квартира · необязательно»
 * (мокап CabVideo .form__two): квартиры блока — по выбору блока, без проданных.
 */
export function ReportTarget({ complexes, months, value, onChange }: ReportTargetProps) {
  const t = useTranslations("admin.video.form");
  const complex = complexes.find((item) => item.id === value.complexId);
  const blocks = complex?.blocks ?? [];
  return (
    <>
      <div className="progress-form__two">
        <SelectField
          id="progress-complex"
          label={t("complex")}
          value={value.complexId}
          options={complexes.map((item) => ({
            value: item.id,
            label: t("complexOption", { name: item.name }),
          }))}
          onChange={(event) => onChange({ complexId: event.target.value })}
        />
        <Choices
          label={t("month")}
          choices={months.map((month) => ({ id: month, label: formatMonthYear(month) }))}
          current={value.month}
          onPick={(month) => onChange({ month })}
        />
      </div>
      <div className="progress-form__two">
        {blocks.length > 1 ? (
          <Choices
            label={t("block")}
            choices={blocks.map((block) => ({
              id: block.id,
              label: t("blockOption", { name: block.name }),
            }))}
            current={value.blockId}
            onPick={(blockId) => onChange({ blockId })}
          />
        ) : null}
        <UnitSelect
          blockId={value.blockId}
          unitId={value.unitId}
          onChange={(unitId) => onChange({ unitId })}
        />
      </div>
    </>
  );
}

type ChoicesProps = {
  label: string;
  choices: readonly Choice[];
  current: string;
  onPick: (id: string) => void;
};

/** Сегмент мокапа: «Октябрь 2026 | Сентябрь 2026», «Блок 1 | Блок 2». */
function Choices({ label, choices, current, onPick }: ChoicesProps) {
  return (
    <div className="progress-form__field">
      <span className="progress-form__label">{label}</span>
      <Segmented label={label} form>
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={segmentedItemClass(choice.id === current)}
            aria-pressed={choice.id === current}
            onClick={() => onPick(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </Segmented>
    </div>
  );
}

const ROOMS: Record<number, string> = {
  0: "студия",
  1: "1-комн.",
  2: "2-комн.",
  3: "3-комн.",
  4: "4-комн.",
};

/** Квартиры блока — по выбору блока, мимо кэша (наличие меняется весь день). */
function useBlockUnits(blockId: string) {
  const [units, setUnits] = useState<{ blockId: string; list: ProgressUnitOption[] } | null>(null);
  useEffect(() => {
    let current = true;
    void readProgressUnitsAction(blockId).then((list) => {
      if (current) setUnits({ blockId, list: list ?? [] });
    });
    return () => {
      current = false;
    };
  }, [blockId]);
  return units?.blockId === blockId ? units.list : null;
}

function UnitSelect({
  blockId,
  unitId,
  onChange,
}: {
  blockId: string;
  unitId: string;
  onChange: (unitId: string) => void;
}) {
  const t = useTranslations("admin.video.form");
  const units = useBlockUnits(blockId);
  // «Кв. 62 · 5 эт. · 3-комн. 86 м² · свободна» (мокап).
  const labelOf = (unit: ProgressUnitOption) => {
    const known = unit.rooms !== null && unit.area !== null;
    const layout = known
      ? t("unitLayout", {
          rooms: ROOMS[unit.rooms!] ?? `${unit.rooms}-комн.`,
          area: formatArea(unit.area!),
        })
      : "";
    const status = t(unit.status === "free" ? "unitFree" : "unitReserved");
    return t("unitOption", { number: unit.number, floor: unit.floor, layout, status });
  };
  return (
    <SelectField
      id="progress-unit"
      label={t("unit")}
      hint={t("unitHint")}
      value={unitId}
      disabled={units === null}
      options={[
        { value: "", label: units === null ? t("unitsLoading") : t("unitNone") },
        ...(units ?? []).map((unit) => ({ value: unit.id, label: labelOf(unit) })),
      ]}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
