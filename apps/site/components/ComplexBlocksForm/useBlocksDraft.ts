"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { newBlockDraft, type BlockDraft } from "@/lib/admin/complexes/blocks";
import type { SaveRowsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { moveItem } from "@/lib/ui/sortable";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";

// Состояние вкладки «Блоки»: черновик карточек, ответ сохранения, «Уйти без сохранения?».

const IDLE: SaveRowsResult = { status: "idle" };

/** after — ключи карточек, что шли за удалённой: «Вернуть» ставит её перед первой оставшейся. */
export type Removed = { row: BlockDraft; after: string[] };

function restoreRow(current: BlockDraft[], { row, after }: Removed): BlockDraft[] {
  const next = after.find((key) => current.some((item) => item.key === key));
  const at = next ? current.findIndex((item) => item.key === next) : current.length;
  return [...current.slice(0, at), row, ...current.slice(at)];
}

/** Карточки формы: удалённые до сохранения можно «Вернуть» на прежнее место. */
function useBlockRows(blocks: readonly BlockDraft[], options: Parameters<typeof useDraftRows>[1]) {
  const draft = useDraftRows(blocks, options);
  const [removed, setRemoved] = useState<Removed[]>([]);
  if (draft.replaced && removed.length > 0) setRemoved([]);
  const { rows, change } = draft;
  return {
    rows,
    removed,
    update: draft.update,
    move: (index: number, to: number) => change((current) => moveItem(current, index, to)),
    add: () => {
      const row = newBlockDraft();
      change((current) => [...current, row]);
      return row.key;
    },
    remove: (key: string) => {
      const index = rows.findIndex((row) => row.key === key);
      if (index < 0) return;
      const after = rows.slice(index + 1).map((row) => row.key);
      setRemoved((current) => [...current, { row: rows[index]!, after }]);
      draft.remove(key);
    },
    restore: (key: string) => {
      const entry = removed.find((item) => item.row.key === key);
      if (!entry) return;
      change((current) => restoreRow(current, entry));
      setRemoved((current) => current.filter((item) => item.row.key !== key));
    },
  };
}

/** Раскрытая карточка; ответ с ошибками раскрывает первую карточку с ошибкой — один раз. */
export function useOpenCard(state: SaveRowsResult) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    const first = state.status === "error" ? Object.keys(state.rowErrors)[0] : undefined;
    if (first) setOpenKey(first);
  }
  return [openKey, setOpenKey] as const;
}

/** Черновик вкладки и сохранение: после «Сохранено» форма снова чистая. */
export function useBlocksDraft(blocks: readonly BlockDraft[], action: FormAction<SaveRowsResult>) {
  const t = useTranslations("admin.complexes.blocks");
  const guard = useUnsavedGuard(t("unsaved"));
  const [state, formAction, pending] = useActionState(
    (_previous: SaveRowsResult, formData: FormData) => action(formData),
    IDLE,
  );
  const savedAt = state.status === "saved" ? state.at : null;
  const rows = useBlockRows(blocks, { dirty: guard.dirty, savedAt, markDirty: guard.onInput });
  const { reset } = guard;
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);
  const rowErrors = state.status === "error" ? state.rowErrors : {};
  return { ...rows, state, formAction, pending, onInput: guard.onInput, rowErrors };
}
