"use client";

import { useActionState, useEffect } from "react";
import type { FormAction } from "@/lib/admin/developers/types";
import { submitKeepingForm } from "./submitKeepingForm";
import { useUnsavedGuard } from "./useUnsavedGuard";

type TabResult = { status: "idle" } | { status: "saved"; at: number } | { status: "error" };

/**
 * «Сохранить вкладку» у вкладок ЖК на обычных полях («Видео», «Документы», «Детали»): ответ
 * действия, «Уйти без сохранения?» до «Сохранено» и отправка без сброса набранного.
 */
export function useTabSave<R extends TabResult>(action: FormAction<R>, unsavedMessage: string) {
  const guard = useUnsavedGuard(unsavedMessage);
  const [state, formAction, pending] = useActionState(
    (_previous: Awaited<R>, formData: FormData) => action(formData),
    { status: "idle" } as Awaited<R>,
  );
  const savedAt = state.status === "saved" ? state.at : null;
  const { reset } = guard;
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);
  return { state, pending, savedAt, dirty: guard.dirty, onSubmit: submitKeepingForm(formAction), onInput: guard.onInput };
}
