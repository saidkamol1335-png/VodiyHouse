"use client";

import { useTranslations } from "next-intl";
import { useMemo, type KeyboardEvent } from "react";
import { BilingualField } from "@/components/BilingualField";
import { FormStatus } from "@/components/FormStatus";
import { ProgramCard } from "@/components/ProgramCard";
import { programTitle, type ProgramsT } from "@/components/ProgramCard/cardText";
import { recordFromDraft, type ProgramDraft } from "@/lib/admin/programs/draft";
import { programItemFrom } from "@/lib/admin/programs/panels";
import type { BankOption, ProgramPanel } from "@/lib/admin/programs/types";
import { PROGRAM_LIMITS } from "@/lib/admin/programs/validate";
import type { ExchangeRate } from "@/lib/calc/money";
import { BlocksField } from "./BlocksField";
import { EditorBasics } from "./EditorBasics";
import { EditorFooter } from "./EditorFooter";
import { errorText } from "./errorText";
import { KindRows } from "./KindRows";
import { TermRules } from "./TermRules";
import { useEditorCommands, type EditorCallbacks } from "./useEditorCommands";
import { useProgramDraft, type ProgramDraftControl } from "./useProgramDraft";

type ProgramEditorProps = EditorCallbacks & {
  initial: ProgramDraft;
  panel: ProgramPanel;
  /** Куда можно скопировать (Р3): другие застройщики. */
  copyTargets: readonly { id: string; name: string }[];
  banks: readonly BankOption[];
  rate: ExchangeRate | null;
  onClose: () => void;
};

const NEW_RECORD_BASE = { is_active: false, sort: 0, created_at: "", updated_at: "" };

/**
 * Открытая карточка (Р2, В1 B): поля слева, справа живое превью карточки с «Примером» — опечатка
 * в ставке видна до «Сохранить»; уже ~1100 px превью встаёт над полями.
 */
export function ProgramEditor(props: ProgramEditorProps) {
  const { item, panel, banks, rate } = props;
  const t = useTranslations("admin.programs");
  const control = useProgramDraft(props.initial, t("editor.leave"));
  const { draft } = control;
  const preview = useMemo(() => {
    const bank = banks.find((option) => option.id === draft.bankId)?.name ?? null;
    return programItemFrom(recordFromDraft(draft, item?.record ?? NEW_RECORD_BASE, bank));
  }, [draft, banks, item]);
  const cancel = () => {
    if (control.dirty && !window.confirm(t("editor.leave"))) return;
    props.onClose();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") cancel();
  };
  return (
    <li className="program-editor" data-testid="program-editor" onKeyDown={onKeyDown}>
      <h3 className="program-editor__title">
        {item ? programTitle(preview, t) : t("editor.newTitle", { kind: t(`kinds.${draft.kind}`) })}
      </h3>
      <div className="program-editor__layout">
        <EditorFields {...props} control={control} onCancel={cancel} t={t} />
        <aside className="program-editor__preview" aria-label={t("editor.preview")}>
          <p className="program-editor__preview-label">{t("editor.preview")}</p>
          <ProgramCard item={preview} panel={panel} rate={rate} preview />
        </aside>
      </div>
    </li>
  );
}

type EditorFieldsProps = ProgramEditorProps & {
  control: ProgramDraftControl;
  onCancel: () => void;
  t: ProgramsT;
};

/** Колонка полей: по виду программы, «Где действует», условия, итог и кнопки. */
function EditorFields({ control, onCancel, t, ...props }: EditorFieldsProps) {
  const { initial, item, panel, banks, copyTargets } = props;
  const commands = useEditorCommands(control, props, t);
  const { draft } = control;
  const editorId = `program-${draft.id ?? "new"}`;
  const nameOf = (id: string) => copyTargets.find((option) => option.id === id)?.name ?? "";
  return (
    <div className="program-editor__fields">
      <EditorBasics control={control} banks={banks} t={t} />
      <KindRows control={control} t={t} />
      {draft.kind === "scheme" ? <TermRules control={control} t={t} /> : null}
      <BlocksField control={control} blocks={panel.blocks} t={t} />
      <BilingualField
        id={`${editorId}-conditions`}
        name="conditions"
        label={t("editor.conditions")}
        defaultValue={initial.conditions}
        maxLength={PROGRAM_LIMITS.conditionsMax}
        multiline
        onChange={(conditions) => control.patch({ conditions })}
        error={errorText(control.errors, "conditions", t)}
      />
      {commands.status ? (
        <FormStatus tone={commands.status.tone}>{commands.status.text}</FormStatus>
      ) : null}
      <EditorFooter
        editorId={editorId}
        saved={item !== null}
        isActive={item?.isActive ?? false}
        pending={commands.pending}
        copyTargets={copyTargets}
        onSave={commands.save}
        onCancel={onCancel}
        onCopy={(id) => commands.copy(id, nameOf(id))}
        onRemove={commands.remove}
        t={t}
      />
    </div>
  );
}
