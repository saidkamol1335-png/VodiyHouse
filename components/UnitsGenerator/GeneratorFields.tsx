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

/** Поля генератора: подъезды, первый жилой, квартир на этаже (одно число или по подъездам), № 1. */
export function GeneratorFields(props: GeneratorFieldsProps) {
  const { idPrefix, inputs, floors, entrances, issues, onChange } = props;
  const t = useTranslations("admin.complexes.units.generator");
  const set = (patch: Partial<GeneratorInputs>) => onChange({ ...inputs, ...patch });
  const issueText = (match: (issue: BlockPlanIssue) => boolean) => {
    const found = issues.find(match);
    return found ? t(`issues.${found.code}`, found) : undefined;
  };
  const issue = (code: BlockPlanIssue["code"]) => issueText((item) => item.code === code);
  const number = { inputMode: "numeric" as const, autoComplete: "off" };
  return (
    <div className="units-generator__fields">
      <Field
        id={`${idPrefix}-entrances`}
        label={t("entrances")}
        {...number}
        value={inputs.entrances}
        error={issue("entrancesOutOfRange")}
        onChange={(event) => set({ entrances: event.target.value })}
      />
      <Field
        id={`${idPrefix}-first`}
        label={t("firstFloor")}
        hint={t("firstFloorHint", { floors })}
        {...number}
        value={inputs.firstFloor}
        error={issue("firstResidentialFloorOutOfRange") ?? issue("floorsOutOfRange")}
        onChange={(event) => set({ firstFloor: event.target.value })}
      />
      {inputs.perEntrance && entrances > 1 ? null : (
        <Field
          id={`${idPrefix}-per-floor`}
          label={t("perFloor")}
          {...number}
          value={inputs.perFloor}
          error={
            // Одно число на все подъезды — без «(подъезд 1)» из текста кода.
            issue("unitsPerFloorOutOfRange")
              ? t("perFloorOutOfRange")
              : issue("unitsPerFloorCountMismatch")
          }
          onChange={(event) => set({ perFloor: event.target.value })}
        />
      )}
      <Field
        id={`${idPrefix}-start`}
        label={t("startNumber")}
        {...number}
        value={inputs.startNumber}
        error={issue("startNumberOutOfRange")}
        onChange={(event) => set({ startNumber: event.target.value })}
      />
      {entrances > 1 ? <PerEntrance {...props} set={set} issueText={issueText} /> : null}
    </div>
  );
}

type PerEntranceProps = GeneratorFieldsProps & {
  set: (patch: Partial<GeneratorInputs>) => void;
  issueText: (match: (issue: BlockPlanIssue) => boolean) => string | undefined;
};

/** «В подъездах по-разному»: своё число у каждого подъезда, начинают с общего. */
function PerEntrance({ idPrefix, inputs, entrances, set, issueText }: PerEntranceProps) {
  const t = useTranslations("admin.complexes.units.generator");
  const values = Array.from(
    { length: entrances },
    (_, index) => inputs.perEntranceValues[index] ?? inputs.perFloor,
  );
  const setValue = (index: number, value: string) =>
    set({ perEntranceValues: values.map((item, at) => (at === index ? value : item)) });
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
            <Field
              key={index}
              id={`${idPrefix}-per-floor-${index + 1}`}
              label={`${t("perFloor")} · ${t("entranceN", { n: index + 1 })}`}
              inputMode="numeric"
              autoComplete="off"
              value={value}
              error={issueText(
                (issue) => issue.code === "unitsPerFloorOutOfRange" && issue.entrance === index + 1,
              )}
              onChange={(event) => setValue(index, event.target.value)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
