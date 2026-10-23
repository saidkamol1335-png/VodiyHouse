"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/Field";
import type { GeneratorInputs } from "@/lib/admin/units/generator";
import type { BlockPlanIssue } from "@/lib/units";

type GeneratorFieldsProps = {
  idPrefix: string;
  inputs: GeneratorInputs;
  floors: number;
  /** Сколько подъездов сейчас в плане: столько полей «по-разному». */
  entrances: number;
  issues: readonly BlockPlanIssue[];
  onChange: (inputs: GeneratorInputs) => void;
};

type NumberFieldProps = {
  id: string;
  label: string;
  hint?: string;
  value: string;
  error: string | undefined;
  onValue: (value: string) => void;
};

/** Поле генератора — только цифры: текстом, без стрелок type=number (как и этажи стояков). */
function NumberField({ onValue, ...field }: NumberFieldProps) {
  return (
    <Field
      {...field}
      inputMode="numeric"
      autoComplete="off"
      onChange={(event) => onValue(event.target.value)}
    />
  );
}

/** Поля генератора: подъезды, первый жилой, квартир на этаже (одно число или по подъездам), № 1. */
export function GeneratorFields(props: GeneratorFieldsProps) {
  const { inputs, entrances, onChange } = props;
  const set = (patch: Partial<GeneratorInputs>) => onChange({ ...inputs, ...patch });
  const { issueText, issue } = useIssueText(props.issues);
  const part = { ...props, set, issueText, issue };
  return (
    <div className="units-generator__fields">
      <PlanFields {...part} />
      <NumberingFields {...part} />
      {entrances > 1 ? <PerEntrance {...part} /> : null}
    </div>
  );
}

/** Текст отказа плана по коду (или по условию — у «по подъездам» свой подъезд). */
function useIssueText(issues: readonly BlockPlanIssue[]) {
  const t = useTranslations("admin.complexes.units.generator");
  const issueText = (match: (issue: BlockPlanIssue) => boolean) => {
    const found = issues.find(match);
    return found ? t(`issues.${found.code}`, found) : undefined;
  };
  const issue = (code: BlockPlanIssue["code"]) => issueText((item) => item.code === code);
  return { issueText, issue };
}

type PartProps = GeneratorFieldsProps & {
  set: (patch: Partial<GeneratorInputs>) => void;
} & ReturnType<typeof useIssueText>;

/** Подъезды и первый жилой этаж. */
function PlanFields({ idPrefix, inputs, floors, set, issue }: PartProps) {
  const t = useTranslations("admin.complexes.units.generator");
  return (
    <>
      <NumberField
        id={`${idPrefix}-entrances`}
        label={t("entrances")}
        value={inputs.entrances}
        error={issue("entrancesOutOfRange")}
        onValue={(entrances) => set({ entrances })}
      />
      <NumberField
        id={`${idPrefix}-first`}
        label={t("firstFloor")}
        hint={t("firstFloorHint", { floors })}
        value={inputs.firstFloor}
        error={issue("firstResidentialFloorOutOfRange") ?? issue("floorsOutOfRange")}
        onValue={(firstFloor) => set({ firstFloor })}
      />
    </>
  );
}

/** Квартир на этаже (одно число, если не «по-разному») и первый номер. */
function NumberingFields({ idPrefix, inputs, entrances, set, issue }: PartProps) {
  const t = useTranslations("admin.complexes.units.generator");
  // Одно число на все подъезды — без «(подъезд 1)» из текста кода.
  const perFloorError = issue("unitsPerFloorOutOfRange")
    ? t("perFloorOutOfRange")
    : issue("unitsPerFloorCountMismatch");
  return (
    <>
      {inputs.perEntrance && entrances > 1 ? null : (
        <NumberField
          id={`${idPrefix}-per-floor`}
          label={t("perFloor")}
          value={inputs.perFloor}
          error={perFloorError}
          onValue={(perFloor) => set({ perFloor })}
        />
      )}
      <NumberField
        id={`${idPrefix}-start`}
        label={t("startNumber")}
        value={inputs.startNumber}
        error={issue("startNumberOutOfRange")}
        onValue={(startNumber) => set({ startNumber })}
      />
    </>
  );
}

/** «В подъездах по-разному»: своё число у каждого подъезда, начинают с общего. */
function PerEntrance({ idPrefix, inputs, entrances, set, issueText }: PartProps) {
  const t = useTranslations("admin.complexes.units.generator");
  const values = Array.from(
    { length: entrances },
    (_, index) => inputs.perEntranceValues[index] ?? inputs.perFloor,
  );
  const setValue = (index: number, value: string) =>
    set({ perEntranceValues: values.map((item, at) => (at === index ? value : item)) });
  const entranceError = (entrance: number) =>
    issueText((issue) => issue.code === "unitsPerFloorOutOfRange" && issue.entrance === entrance);
  return (
    <div className="units-generator__per-entrance">
      <label className="units-generator__check">
        <input
          type="checkbox"
          checked={inputs.perEntrance}
          onChange={(event) =>
            set({ perEntrance: event.target.checked, perEntranceValues: values })
          }
        />
        {t("perEntrance")}
      </label>
      {inputs.perEntrance ? (
        <div className="units-generator__entrances">
          {values.map((value, index) => (
            <NumberField
              key={index}
              id={`${idPrefix}-per-floor-${index + 1}`}
              label={`${t("perFloor")} · ${t("entranceN", { n: index + 1 })}`}
              value={value}
              error={entranceError(index + 1)}
              onValue={(next) => setValue(index, next)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
