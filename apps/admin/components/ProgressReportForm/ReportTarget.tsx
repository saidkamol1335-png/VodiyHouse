"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { SelectField } from "@/components/SelectField";
import { readProgressUnitsAction } from "@/lib/admin/actions/progressReports";
import type { ProgressFormComplex, ProgressUnitOption } from "@/lib/admin/progress/types";
import { formatArea } from "@vh/shared/format";
import { ShotDateField } from "./ShotDateField";

export type ReportTargetValue = {
  complexId: string;
  shotOn: string;
  blockId: string;
  unitId: string;
};

type ReportTargetProps = {
  complexes: readonly ProgressFormComplex[];
  /** Окно даты съёмки по Ташкенту (сервер): «2026-09-04» … «2026-11-03». */
  shotBounds: { min: string; max: string };
  /** Прежняя дата возвращённого отчёта — её можно оставить и вне окна. */
  keepShot?: string | null;
  value: ReportTargetValue;
  onChange: (patch: Partial<ReportTargetValue>) => void;
  /** Черновик и возвращённый отчёт: ЖК не меняется (фото уже в его папке). */
  lockComplex?: boolean;
};

type Choice = { id: string; label: string };

/**
 * «ЖК · Дата съёмки» (фаза E, п. 33), «Блок» (только если строящихся блоков несколько) и «Квартира ·
 * необязательно» (мокап CabVideo .form__two): квартиры блока — по выбору блока, без проданных.
 */
export function ReportTarget({
  complexes,
  shotBounds,
  keepShot = null,
  value,
  onChange,
  lockComplex = false,
}: ReportTargetProps) {
  const complex = complexes.find((item) => item.id === value.complexId);
  const blocks = complex?.blocks ?? [];
  return (
    <>
      <div className="progress-form__two">
        <ComplexSelect
          complexes={complexes}
          value={value.complexId}
          locked={lockComplex}
          onChange={(complexId) => onChange({ complexId })}
        />
        <ShotDateField
          value={value.shotOn}
          min={shotBounds.min}
          max={shotBounds.max}
          keep={keepShot}
          onChange={(shotOn) => onChange({ shotOn })}
        />
      </div>
      <BlockUnitRow blocks={blocks} value={value} onChange={onChange} />
    </>
  );
}

type ChoicesProps = {
  label: string;
  choices: readonly Choice[];
  current: string;
  onPick: (id: string) => void;
};

/** Сегмент мокапа: «Блок 1 | Блок 2». */
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

/**
 * Квартиры блока — по выбору блока, мимо кэша (наличие меняется весь день). Обрыв связи на стройке
 * (фаза E, п. 37): запрос повторяется, когда сеть вернётся, — поле не остаётся в «Загружаем…».
 */
function useBlockUnits(blockId: string) {
  const [units, setUnits] = useState<{ blockId: string; list: ProgressUnitOption[] } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    const retry = () => current && setAttempt((value) => value + 1);
    readProgressUnitsAction(blockId).then(
      (list) => {
        if (current) setUnits({ blockId, list: list ?? [] });
      },
      () => (navigator.onLine ? setTimeout(retry, 5_000) : window.addEventListener("online", retry, { once: true })),
    );
    return () => {
      current = false;
      window.removeEventListener("online", retry);
    };
  }, [blockId, attempt]);
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
  // Исправление: квартиру отчёта с тех пор продали — выбор «весь ЖК / блок» виден, а не скрыт.
  useEffect(() => {
    if (units && unitId && !units.some((unit) => unit.id === unitId)) onChange("");
  }, [units, unitId, onChange]);
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

type ComplexSelectProps = {
  complexes: readonly ProgressFormComplex[];
  value: string;
  locked: boolean;
  onChange: (complexId: string) => void;
};

/** «ЖК»: «ЖК Yulduz» — только со строящимися блоками. */
function ComplexSelect({ complexes, value, locked, onChange }: ComplexSelectProps) {
  const t = useTranslations("admin.video.form");
  return (
    <SelectField
      id="progress-complex"
      label={t("complex")}
      value={value}
      disabled={locked}
      options={complexes.map((item) => ({
        value: item.id,
        label: t("complexOption", { name: item.name }),
      }))}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

type BlockUnitRowProps = {
  blocks: readonly { id: string; name: string }[];
  value: ReportTargetValue;
  onChange: (patch: Partial<ReportTargetValue>) => void;
};

/** «Блок» (если строящихся несколько) и «Квартира · необязательно». */
function BlockUnitRow({ blocks, value, onChange }: BlockUnitRowProps) {
  const t = useTranslations("admin.video.form");
  return (
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
  );
}
