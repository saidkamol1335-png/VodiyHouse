"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { newLayoutDraft, type BlockLayouts, type LayoutDraft, type LayoutRowErrors } from "@/lib/admin/complexes/layouts";
import type { SaveRowsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";

const IDLE: SaveRowsResult = { status: "idle" };

type LayoutsDraftParams = {
  block: BlockLayouts;
  action: FormAction<SaveRowsResult>;
  onSwitch: (blockId: string) => void;
};

/** Строки планировок блока и сохранение блоком; другой блок с правками — только после «Уйти?». */
export function useLayoutsDraft({ block, action, onSwitch }: LayoutsDraftParams) {
  const t = useTranslations("admin.complexes.layouts");
  const guard = useUnsavedGuard(t("unsaved"));
  const [state, formAction, pending] = useActionState((_previous: SaveRowsResult, formData: FormData) => action(formData), IDLE);
  const savedAt = state.status === "saved" ? state.at : null;
  const { reset, dirty } = guard;
  const { rows, update, change, remove } = useDraftRows(block.layouts, {
    dirty,
    savedAt,
    markDirty: guard.onInput,
  });
  const add = (copies: LayoutDraft[] = [newLayoutDraft()]) => change((current) => [...current, ...copies]);
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);
  const rowErrors = (state.status === "error" ? state.rowErrors : {}) as LayoutRowErrors;
  const switchTo = (next: string) => {
    if (next === block.blockId) return;
    if (dirty && !window.confirm(t("unsaved"))) return;
    onSwitch(next);
  };
  const onInput = guard.onInput;
  return { state, formAction, pending, onInput, rows, update, remove, add, rowErrors, switchTo };
}

export type LayoutsDraft = ReturnType<typeof useLayoutsDraft>;
