"use client";

import { useActionState } from "react";
import type { FormAction, SaveShowcaseResult } from "./types";

/** Общее у трёх форм витрины: состояние действия, «сохранено» и ошибки по полям. */
export function useShowcaseForm<Fields, Errors>(action: FormAction<SaveShowcaseResult<Fields, Errors>>) {
  const idle: SaveShowcaseResult<Fields, Errors> = { status: "idle" };
  const [state, formAction, pending] = useActionState(
    (_previous: SaveShowcaseResult<Fields, Errors>, formData: FormData) => action(formData),
    idle,
  );
  const failed = state.status === "error" ? state : null;
  return { state, formAction, pending, failed };
}
