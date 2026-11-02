"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormAction } from "@/lib/admin/developers/types";
import { settle } from "./settle";
import { submitKeepingForm } from "./submitKeepingForm";
import { useUnsavedGuard } from "./useUnsavedGuard";

type TabResult = { status: "idle" } | { status: "saved"; at: number } | { status: "error" };

// Обрыв связи или 5xx — ответ «нет связи» у кнопки, а не экран ошибки: набранное остаётся.
const NETWORK_FAILURE = { status: "error", error: "network", errors: {}, broken: [] } as const;

/**
 * «Сохранить вкладку» у вкладок ЖК на обычных полях («Видео», «Документы», «Детали»): ответ
 * действия, «Уйти без сохранения?» до «Сохранено» и отправка без сброса набранного.
 */
export function useTabSave<R extends TabResult>(action: FormAction<R>, unsavedMessage: string) {
  const guard = useUnsavedGuard(unsavedMessage);
  const [state, formAction, pending] = useActionState(
    (_previous: Awaited<R>, formData: FormData) => settle(() => action(formData), NETWORK_FAILURE as unknown as Awaited<R>),
    { status: "idle" } as Awaited<R>,
  );
  const savedAt = state.status === "saved" ? state.at : null;
  const { reset } = guard;
  // Правка во время сохранения в него не попала: после «Сохранено» она остаётся несохранённой,
  // и «Уйти без сохранения?» должно сработать.
  const editedDuringSave = useRef(false);
  useEffect(() => {
    if (savedAt && !editedDuringSave.current) reset();
    editedDuringSave.current = false;
  }, [savedAt, reset]);
  const onInput = () => {
    if (pending) editedDuringSave.current = true;
    guard.onInput();
  };
  return { state, pending, savedAt, dirty: guard.dirty, onSubmit: submitKeepingForm(formAction), onInput };
}
