"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type {
  DictionaryItem,
  DictionaryItemErrors,
  DictionaryKey,
} from "@/lib/admin/dictionaries/definitions";
import type { DictionaryActionResult, DictionaryActionSet } from "@/lib/admin/dictionaries/types";

// Состояние справочника (Д6): какая строка правится, ответ последнего действия, команды.

type Feedback = { tone: "success" | "error"; text: string };
type FormAction = (formData: FormData) => Promise<DictionaryActionResult>;
type Success = (result: DictionaryActionResult) => string;

function formOf(fields: Record<string, string | number>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, String(value));
  return form;
}

/** Строки — из базы; после действия сервер присылает новый список (refresh), он и становится строками. */
export function useSyncedRows(items: readonly DictionaryItem[]) {
  const [rows, setRows] = useState<DictionaryItem[]>([...items]);
  const [source, setSource] = useState(items);
  if (items !== source) {
    setSource(items);
    setRows([...items]);
  }
  return [rows, setRows] as const;
}

/** Правка на месте: одна строка (или новая) и один вопрос «Удалить?» за раз. */
function useEditState() {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [errors, setErrors] = useState<DictionaryItemErrors>({});
  const startEdit = (target: number | "new") => {
    setErrors({});
    setConfirming(null);
    setEditing(target);
  };
  const done = () => {
    setErrors({});
    setEditing(null);
    setConfirming(null);
  };
  const stopEdit = () => setEditing(null);
  return { editing, confirming, errors, setErrors, setConfirming, startEdit, stopEdit, done };
}

/** Действие базы: отказ — ошибки полей и текст; успех — правка закрыта, текст успеха. */
export function useDictionaryForm() {
  const t = useTranslations("admin");
  const edit = useEditState();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: FormAction, formData: FormData, success: Success) =>
    startTransition(async () => {
      const result = await action(formData);
      if (result.status === "error") {
        edit.setErrors(result.fieldErrors);
        setFeedback(
          result.error ? { tone: "error", text: t(`developers.errors.${result.error}`) } : null,
        );
        return;
      }
      edit.done();
      setFeedback({ tone: "success", text: success(result) });
    });
  return { ...edit, feedback, pending, run };
}

export type DictionaryForm = ReturnType<typeof useDictionaryForm>;

/** Удаление занятого значения база заменяет скрытием — об этом и говорим. */
const removedKey = (result: DictionaryActionResult) =>
  result.status === "done" && result.outcome === "hidden" ? "hiddenInstead" : ("removed" as const);

/** Команды справочника поверх run: что отправить и какой текст показать после. */
export function useDictionaryCommands(
  dictionary: DictionaryKey,
  actions: DictionaryActionSet,
  run: DictionaryForm["run"],
) {
  const t = useTranslations("admin.dictionaries");
  const saved = () => t("saved");
  return {
    add: (data: FormData) => run(actions.add, data, saved),
    update: (data: FormData) => run(actions.update, data, saved),
    reorder: (next: DictionaryItem[]) =>
      run(
        actions.reorder,
        formOf({ dictionary, order: JSON.stringify(next.map((item) => item.id)) }),
        () => t("reordered"),
      ),
    toggle: (item: DictionaryItem) =>
      run(
        actions.setActive,
        formOf({ dictionary, id: item.id, active: String(!item.isActive) }),
        saved,
      ),
    remove: (item: DictionaryItem) =>
      run(actions.remove, formOf({ dictionary, id: item.id }), (result) =>
        t(removedKey(result), { name: item.name.ru }),
      ),
  };
}

export type DictionaryCommands = ReturnType<typeof useDictionaryCommands>;
