"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import { SelectField } from "@/components/SelectField";

type EditorFooterProps = {
  editorId: string;
  /** Сохранённая программа: копия и удаление есть только у неё. */
  saved: boolean;
  isActive: boolean;
  pending: boolean;
  copyTargets: readonly { id: string; name: string }[];
  onSave: () => void;
  onCancel: () => void;
  onCopy: (developerId: string) => void;
  onRemove: () => void;
  t: ProgramsT;
};

/** Низ открытой карточки: «Сохранить / Отмена», «Скопировать к застройщику» (Р3), «Удалить» (Р4). */
export function EditorFooter(props: EditorFooterProps) {
  const { saved, pending, t } = props;
  return (
    <div className="program-editor__footer">
      <div className="program-editor__actions">
        <Button pending={pending} onClick={props.onSave}>
          {t("editor.save")}
        </Button>
        <Button variant="ghost" onClick={props.onCancel} disabled={pending}>
          {t("editor.cancel")}
        </Button>
      </div>
      {saved ? (
        <div className="program-editor__extra">
          <CopyControl {...props} />
          <RemoveControl {...props} />
        </div>
      ) : null}
    </div>
  );
}

function CopyControl({ editorId, copyTargets, pending, onCopy, t }: EditorFooterProps) {
  const [target, setTarget] = useState("");
  if (copyTargets.length === 0) return null;
  return (
    <div className="program-editor__copy">
      <SelectField
        id={`${editorId}-copy`}
        label={t("editor.copy.label")}
        options={copyTargets.map((option) => ({ value: option.id, label: option.name }))}
        placeholder={t("editor.copy.target")}
        value={target}
        onChange={(event) => setTarget(event.target.value)}
      />
      <Button
        size="sm"
        variant="ghost"
        disabled={!target || pending}
        onClick={() => onCopy(target)}
      >
        {t("editor.copy.submit")}
      </Button>
    </div>
  );
}

function RemoveControl({ isActive, pending, onRemove, t }: EditorFooterProps) {
  const [confirming, setConfirming] = useState(false);
  if (isActive) return <p className="program-editor__hint">{t("editor.remove.onlyOff")}</p>;
  if (!confirming) {
    return (
      <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
        {t("editor.remove.label")}
      </Button>
    );
  }
  return (
    <div className="program-editor__confirm" role="group" aria-label={t("editor.remove.confirm")}>
      <span>{t("editor.remove.confirm")}</span>
      <Button size="sm" variant="danger" pending={pending} onClick={onRemove}>
        {t("editor.remove.yes")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        {t("editor.remove.no")}
      </Button>
    </div>
  );
}
