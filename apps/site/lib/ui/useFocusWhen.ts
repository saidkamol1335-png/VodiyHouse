"use client";

import { useEffect, useRef } from "react";

/**
 * Кнопка сменилась тем, что она открыла (карта, плеер): фокус — на появившийся элемент, а не в body,
 * куда его роняет пропавшая кнопка.
 */
export function useFocusWhen<T extends HTMLElement>(shown: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (shown) ref.current?.focus();
  }, [shown]);
  return ref;
}
