"use client";

import type { ProgramsT } from "@/components/ProgramCard/cardText";
import { PRESET_MONTHS, type OverMaxBehavior } from "@/lib/calc/programs";
import { SegmentChoice } from "./SegmentChoice";
import type { ProgramDraftControl } from "./useProgramDraft";

const BEHAVIORS: readonly OverMaxBehavior[] = ["block", "suggest_tier", "lead"];

type TermRulesProps = { control: ProgramDraftControl; t: ProgramsT };

/** Правила сроков схемы застройщика (PLAN §3б): кнопки 12/24/36/48, свой срок, превышение. */
export function TermRules({ control, t }: TermRulesProps) {
  const { draft, patch } = control;
  return (
    <fieldset className="program-editor__rules">
      <legend className="program-editor__legend">{t("editor.rules.title")}</legend>
      <PresetPills control={control} t={t} />
      <label className="program-editor__check">
        <input
          type="checkbox"
          checked={draft.allowCustomMonths}
          onChange={(event) => patch({ allowCustomMonths: event.target.checked })}
        />
        {t("editor.rules.custom")}
      </label>
      <div className="program-editor__over">
        <span className="program-editor__label">{t("editor.rules.overMax")}</span>
        <SegmentChoice
          label={t("editor.rules.overMax")}
          value={draft.overMaxBehavior}
          options={BEHAVIORS.map((behavior) => ({
            value: behavior,
            label: t(`editor.rules.overMaxOptions.${behavior}`),
          }))}
          onChange={(overMaxBehavior) => patch({ overMaxBehavior })}
        />
      </div>
    </fieldset>
  );
}

/** Кнопки сроков, которые увидит клиент: пилюли-переключатели. */
function PresetPills({ control, t }: TermRulesProps) {
  const { draft, patch } = control;
  const toggle = (months: number) =>
    patch({
      presetMonths: draft.presetMonths.includes(months)
        ? draft.presetMonths.filter((value) => value !== months)
        : [...draft.presetMonths, months],
    });
  return (
    <div className="program-editor__presets" role="group" aria-label={t("editor.rules.presets")}>
      <span className="program-editor__label">{t("editor.rules.presets")}</span>
      {PRESET_MONTHS.map((months) => (
        <button
          key={months}
          type="button"
          className="program-editor__preset"
          aria-pressed={draft.presetMonths.includes(months)}
          onClick={() => toggle(months)}
        >
          {t("card.months", { count: months })}
        </button>
      ))}
    </div>
  );
}
