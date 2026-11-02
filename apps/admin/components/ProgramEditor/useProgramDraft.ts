"use client";

import { useState } from "react";
import {
  emptyFee,
  emptyTerm,
  emptyTier,
  type FeeDraft,
  type ProgramDraft,
  type TermDraft,
  type TierDraft,
} from "@/lib/admin/programs/draft";
import type { ProgramFieldErrors } from "@/lib/admin/programs/types";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";

// Черновик открытой карточки (Р2): поля, строки ступеней, сроков и разовых, ошибки по полям и
// «Уйти без сохранения?» при переходе со страницы.

type RowList = "tiers" | "terms" | "fees";
type RowOf<K extends RowList> = ProgramDraft[K][number];

/** Новая строка списка; разовый берёт свободное название (rows — уже набранные). */
const EMPTY_ROW: { [K in RowList]: (rows: readonly RowOf<K>[]) => RowOf<K> } = {
  tiers: () => emptyTier(),
  terms: () => emptyTerm(),
  fees: (rows) => emptyFee("pct", rows),
};

export type RowCommands<Row> = {
  add: () => void;
  update: (key: string, fields: Partial<Row>) => void;
  remove: (key: string) => void;
};

export function useProgramDraft(initial: ProgramDraft, leaveMessage: string) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<ProgramFieldErrors>({});
  const guard = useUnsavedGuard(leaveMessage);

  const patch = (fields: Partial<ProgramDraft>) => {
    setDraft((current) => ({ ...current, ...fields }));
    guard.onInput();
  };

  function rows<K extends RowList>(list: K): RowCommands<RowOf<K>> {
    const change = (next: (rows: RowOf<K>[]) => RowOf<K>[]) => {
      setDraft((current) => ({ ...current, [list]: next(current[list] as RowOf<K>[]) }));
      guard.onInput();
    };
    return {
      add: () => change((current) => [...current, EMPTY_ROW[list](current)]),
      update: (key, fields) =>
        change((current) => current.map((row) => (row.key === key ? { ...row, ...fields } : row))),
      remove: (key) => change((current) => current.filter((row) => row.key !== key)),
    };
  }

  return {
    draft,
    errors,
    setErrors,
    patch,
    tiers: rows("tiers") as RowCommands<TierDraft>,
    terms: rows("terms") as RowCommands<TermDraft>,
    fees: rows("fees") as RowCommands<FeeDraft>,
    dirty: guard.dirty,
    resetDirty: guard.reset,
  };
}

export type ProgramDraftControl = ReturnType<typeof useProgramDraft>;
