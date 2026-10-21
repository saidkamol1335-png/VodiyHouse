"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UnitsLayout } from "@/lib/admin/units/types";
import { formatArea } from "@/lib/format";
import type { BlockPlan, Riser, RiserIssue } from "@/lib/units";

// Строка стояка: подъезды · этажи от–до · планировка · «убрать». Ошибка — текстом под строкой
// и через aria-describedby у полей (не role=alert: она мигала бы на каждое нажатие).

type RowProps = {
  id: string;
  riser: Riser;
  plan: BlockPlan;
  layouts: readonly UnitsLayout[];
  issue: RiserIssue | undefined;
  removable: boolean;
  onChange: (patch: Partial<Riser>) => void;
  onRemove: () => void;
};

/** Общие свойства полей строки: ошибка строки связана с каждым её полем. */
type ControlState = { describedBy: string | undefined };

export function RiserRow({
  id,
  riser,
  plan,
  layouts,
  issue,
  removable,
  onChange,
  onRemove,
}: RowProps) {
  const t = useTranslations("admin.complexes.units.risers");
  const state: ControlState = { describedBy: issue ? `${id}-issue` : undefined };
  const refine = riser.entrance !== null;
  return (
    <li className={refine ? "risers-editor__row risers-editor__row--refine" : "risers-editor__row"}>
      <RiserScope
        id={id}
        riser={riser}
        entrances={plan.entrances}
        state={state}
        onChange={onChange}
      />
      <FloorInput
        id={`${id}-from`}
        label={t("floorFrom")}
        value={riser.floorFrom}
        state={state}
        onChange={(floorFrom) => onChange({ floorFrom })}
      />
      <FloorInput
        id={`${id}-to`}
        label={t("floorTo")}
        value={riser.floorTo}
        state={state}
        onChange={(floorTo) => onChange({ floorTo })}
      />
      <LayoutSelect
        id={`${id}-layout`}
        value={riser.layoutId}
        layouts={layouts}
        onChange={(layoutId) => onChange({ layoutId })}
      />
      {removable ? (
        <button
          type="button"
          className="risers-editor__remove"
          aria-label={t("remove")}
          onClick={onRemove}
        >
          <X aria-hidden="true" size={16} />
        </button>
      ) : (
        <span className="risers-editor__remove-gap" />
      )}
      {issue ? (
        <p id={`${id}-issue`} className="risers-editor__issue">
          {t(`issues.${issue.code}`)}
        </p>
      ) : null}
    </li>
  );
}

const inputClass = (state: ControlState, base: string) =>
  state.describedBy ? `${base} ${base}--error` : base;

type FloorInputProps = {
  id: string;
  label: string;
  value: number;
  state: ControlState;
  onChange: (floor: number) => void;
};

/**
 * Этаж — только цифры (текстовое поле, как у генератора: без стрелок type=number); пустое —
 * NaN, проверка стояков покажет «этажи — в пределах жилых».
 */
function FloorInput({ id, label, value, state, onChange }: FloorInputProps) {
  return (
    <label className="risers-editor__floor" htmlFor={id}>
      <span className="risers-editor__label">{label}</span>
      <input
        id={id}
        className={inputClass(state, "risers-editor__input")}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={state.describedBy ? true : undefined}
        aria-describedby={state.describedBy}
        value={Number.isNaN(value) ? "" : value}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (raw === "" || /^\d+$/.test(raw)) onChange(raw === "" ? Number.NaN : Number(raw));
        }}
      />
    </label>
  );
}

type LayoutSelectProps = {
  id: string;
  value: string | null;
  layouts: readonly UnitsLayout[];
  onChange: (layoutId: string | null) => void;
};

function LayoutSelect({ id, value, layouts, onChange }: LayoutSelectProps) {
  const t = useTranslations("admin.complexes.units");
  return (
    <label className="risers-editor__layout" htmlFor={id}>
      <span className="risers-editor__label">{t("risers.layout")}</span>
      <select
        id={id}
        className="risers-editor__select"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{t("risers.noLayout")}</option>
        {layouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {t("layoutLabel", { rooms: layout.rooms, area: formatArea(layout.area) })}
          </option>
        ))}
      </select>
    </label>
  );
}

type ScopeProps = {
  id: string;
  riser: Riser;
  entrances: number;
  state: ControlState;
  onChange: (patch: Partial<Riser>) => void;
};

/** Общий стояк — «Все подъезды»; уточнение — выбор подъезда. */
function RiserScope({ id, riser, entrances, state, onChange }: ScopeProps) {
  const t = useTranslations("admin.complexes.units.risers");
  if (riser.entrance === null) {
    return (
      <span className="risers-editor__scope risers-editor__scope--all">{t("allEntrances")}</span>
    );
  }
  return (
    <label className="risers-editor__scope" htmlFor={`${id}-entrance`}>
      <span className="risers-editor__label">{t("entrance")}</span>
      <select
        id={`${id}-entrance`}
        className={inputClass(state, "risers-editor__select")}
        aria-invalid={state.describedBy ? true : undefined}
        aria-describedby={state.describedBy}
        value={riser.entrance}
        onChange={(event) => onChange({ entrance: Number(event.target.value) })}
      >
        {Array.from({ length: entrances }, (_, index) => (
          <option key={index + 1} value={index + 1}>
            {t("entranceN", { n: index + 1 })}
          </option>
        ))}
      </select>
    </label>
  );
}
