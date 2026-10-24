"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type TransitionStartFunction } from "react";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import type { ProgramActions, ProgramItem } from "@/lib/admin/programs/types";
import { validateDraft } from "@/lib/admin/programs/validate";
import type { ProgramDraftControl } from "./useProgramDraft";

// Команды открытой карточки: сохранить, скопировать к застройщику, удалить. Ответ действия
// сразу меняет экран (onSaved и др.), не дожидаясь перерисовки страницы.

export type EditorStatus = { tone: "error" | "success"; text: string } | null;

export type EditorCallbacks = {
  actions: Pick<ProgramActions, "save" | "copy" | "remove">;
  item: ProgramItem | null;
  onSaved: (item: ProgramItem) => void;
  onCopied: (item: ProgramItem) => void;
  onRemoved: (id: string) => void;
};

type CommandContext = {
  control: ProgramDraftControl;
  callbacks: EditorCallbacks;
  run: TransitionStartFunction;
  failed: (error: string | null) => void;
  succeeded: (text: string) => void;
  t: ProgramsT;
};

const formOf = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
};

function saveCommand({ control, callbacks, run, failed, succeeded, t }: CommandContext) {
  const checked = validateDraft(control.draft);
  if (!checked.ok) {
    control.setErrors(checked.errors);
    return failed(null);
  }
  run(async () => {
    const program = JSON.stringify(checked.payload);
    const result = await callbacks.actions.save(formOf({ program }));
    if (result.status === "error") {
      control.setErrors(result.fieldErrors);
      return failed(result.error);
    }
    control.setErrors({});
    control.resetDirty();
    succeeded(t("editor.saved"));
    callbacks.onSaved(result.payload);
  });
}

function copyCommand(context: CommandContext, developerId: string, name: string) {
  const { callbacks, run, failed, succeeded, t } = context;
  const item = callbacks.item;
  if (!item) return;
  run(async () => {
    const result = await callbacks.actions.copy(formOf({ id: item.id, developerId }));
    if (result.status === "error") return failed(result.error);
    succeeded(t("editor.copy.done", { name }));
    callbacks.onCopied(result.payload);
  });
}

function removeCommand({ callbacks, run, failed }: CommandContext) {
  const item = callbacks.item;
  if (!item) return;
  run(async () => {
    const fields = { id: item.id, developerId: item.developerId };
    const result = await callbacks.actions.remove(formOf(fields));
    if (result.status === "error") return failed(result.error);
    callbacks.onRemoved(item.id);
  });
}

export function useEditorCommands(
  control: ProgramDraftControl,
  callbacks: EditorCallbacks,
  t: ProgramsT,
) {
  const tAdmin = useTranslations("admin");
  const [pending, run] = useTransition();
  const [status, setStatus] = useState<EditorStatus>(null);
  const failed = (error: string | null) =>
    setStatus({
      tone: "error",
      text: tAdmin(`developers.errors.${(error ?? "invalid") as "invalid"}`),
    });
  const succeeded = (text: string) => setStatus({ tone: "success", text });
  const context: CommandContext = { control, callbacks, run, failed, succeeded, t };
  return {
    pending,
    status,
    save: () => saveCommand(context),
    copy: (developerId: string, name: string) => copyCommand(context, developerId, name),
    remove: () => removeCommand(context),
  };
}
