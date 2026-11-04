"use client";

import { useSyncExternalStore } from "react";

/** Мышь или тачпад: есть наведение и точный указатель. На тач-экране эффектов курсора нет. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(FINE_POINTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Точный указатель сейчас; на сервере — нет (эффекты курсора включаются после гидратации). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(FINE_POINTER_QUERY).matches,
    () => false,
  );
}
