"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UnitsLayout } from "@/lib/admin/units/types";
import { useLayoutLabel } from "@/lib/admin/units/useLayoutLabel";
import type { BlockPlan, Riser, RiserIssue } from "@/lib/units";

// Строка стояка: подъезды · этажи от–до · планировка · «убрать». Ошибка — текстом под строкой
// и через aria-describedby у полей (не role=alert: она мигала бы на каждое нажатие). Позиция —
// тоже описанием каждого поля: при переходе по Tab заголовок списка диктор не называет.

type RowProps = {
  id: string;
  /** Заголовок «Позиция N» — описание полей строки. */
  titleId: string;
  riser: Riser;
  plan: BlockPlan;
  layouts: readonly UnitsLayout[];
  issue: RiserIssue | undefined;
  removable: boolean;
  onChange: (patch: Partial<Riser>) => void;
  onRemove: () => void;
};

/** Общие свойства полей строки: позиция и ошибка строки связаны с каждым её полем. */
type ControlState = { describedBy: string; invalid: boolean };

export function RiserRow(props: RowProps) {
  const { id, riser, plan, issue, onChange } = props;
  const t = useTranslations("admin.complexes.units.risers");
  const issueId = `${id}-issue`;
  const state: ControlState = {
    describedBy: issue ? `${props.titleId} ${issueId}` : props.titleId,
    invalid: issue !== undefined,
  };
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
      <Floors id={id} riser={riser} state={state} onChange={onChange} />
      <LayoutSelect
        id={`${id}-layout`}
        value={riser.layoutId}
        layouts={props.layouts}
        describedBy={state.describedBy}
        onChange={(layoutId) => onChange({ layoutId })}
      />
      <RowRemove {...props} />
      {issue ? (
        <p id={issueId} className="risers-editor__issue">
          {t(`issues.${issue.code}`)}
        </p>
      ) : null}
    </li>
  );
}

/** «×» с именем строки: у каждой позиции и подъезда их несколько — «Убрать строку» одно на всех. */
function RowRemove({ riser, removable, onRemove }: RowProps) {
  const t = useTranslations("admin.complexes.units.risers");
  if (!removable) return <span className="risers-editor__remove-gap" />;
  const label = t("removeRow", {
    position: riser.position,
    entrance: riser.entrance === null ? "all" : String(riser.entrance),
    from: riser.floorFrom,
    to: riser.floorTo,
  });
  return (
    <button type="button" className="risers-editor__remove" aria-label={label} onClick={onRemove}>
      <X aria-hidden="true" size={16} />
    </button>
  );
}

/** Вид — общий с Field (field__input и его --error), размер — свой элемент блока. */
const inputClass = (state: ControlState, own: string) =>
  `field__input ${own}${state.invalid ? " field__input--error" : ""}`;

type FloorsProps = Pick<RowProps, "id" | "riser" | "onChange"> & { state: ControlState };

/** «Этаж от» и «Этаж до» строки. */
function Floors({ id, riser, state, onChange }: FloorsProps) {
  const t = useTranslations("admin.complexes.units.risers");
  return (
    <>
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
    </>
  );
}

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
        aria-invalid={state.invalid || undefined}
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
  describedBy: string;
  onChange: (layoutId: string | null) => void;
};

function LayoutSelect({ id, value, layouts, describedBy, onChange }: LayoutSelectProps) {
  const t = useTranslations("admin.complexes.units");
  const label = useLayoutLabel(layouts);
  return (
    <label className="risers-editor__layout" htmlFor={id}>
      <span className="risers-editor__label">{t("risers.layout")}</span>
      <select
        id={id}
        className="field__input risers-editor__select"
        aria-describedby={describedBy}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{t("risers.noLayout")}</option>
        {layouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {label(layout)}
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
        aria-invalid={state.invalid || undefined}
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
