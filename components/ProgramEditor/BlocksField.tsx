"use client";

import type { ProgramsT } from "@/components/ProgramCard/cardText";
import type { ProgramBlockOption } from "@/lib/admin/programs/types";
import { errorText } from "./errorText";
import { SegmentChoice } from "./SegmentChoice";
import type { ProgramDraftControl } from "./useProgramDraft";

type BlocksFieldProps = {
  control: ProgramDraftControl;
  blocks: readonly ProgramBlockOption[];
  t: ProgramsT;
};

/** «Где действует»: все блоки застройщика (и будущие) или выбранные галочками. */
export function BlocksField({ control, blocks, t }: BlocksFieldProps) {
  const { draft, errors, patch } = control;
  const error = errorText(errors, "blocks", t);
  return (
    <fieldset className="program-editor__blocks">
      <legend className="program-editor__legend">{t("editor.blocks.title")}</legend>
      <SegmentChoice
        label={t("editor.blocks.title")}
        value={draft.blocksScope}
        options={[
          { value: "all", label: t("editor.blocks.all") },
          { value: "selected", label: t("editor.blocks.selected") },
        ]}
        onChange={(blocksScope) => patch({ blocksScope })}
      />
      {draft.blocksScope === "selected" ? <BlockChecklist {...{ control, blocks, t }} /> : null}
      {error ? <p className="program-editor__error">{error}</p> : null}
    </fieldset>
  );
}

function BlockChecklist({ control, blocks, t }: BlocksFieldProps) {
  const { draft, patch } = control;
  if (blocks.length === 0)
    return <p className="program-editor__hint">{t("editor.blocks.empty")}</p>;
  const toggle = (id: string, checked: boolean) =>
    patch({
      blockIds: checked ? [...draft.blockIds, id] : draft.blockIds.filter((value) => value !== id),
    });
  return (
    <ul className="program-editor__block-list">
      {blocks.map((block) => (
        <li key={block.id}>
          <label className="program-editor__check">
            <input
              type="checkbox"
              checked={draft.blockIds.includes(block.id)}
              onChange={(event) => toggle(block.id, event.target.checked)}
            />
            {t("editor.blocks.option", { complex: block.complexName.ru, block: block.name })}
          </label>
        </li>
      ))}
    </ul>
  );
}
