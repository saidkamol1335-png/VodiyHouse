"use client";

import { useEffect } from "react";
import { useFinePointer } from "./finePointer";
import { subscribePointer, type PointerSubscriber } from "./pointerHub";
import { useMotion } from "./useMotion";

export type PointerEffect = PointerSubscriber & {
  /** Снять следы с элементов: режим сменился, компонент ушёл. */
  stop?: () => void;
};

/**
 * Эффект курсора: работает только в full и только у мыши (на телефоне у каждого блока свой
 * вариант на касание). create вызывается заново при каждом включении.
 */
export function usePointerEffect(create: () => PointerEffect, enabled = true): void {
  const tier = useMotion();
  const fine = useFinePointer();
  const on = enabled && fine && tier !== "none";
  useEffect(() => {
    if (!on) return;
    const effect = create();
    const unsubscribe = subscribePointer(effect);
    return () => {
      unsubscribe();
      effect.stop?.();
    };
    // create — фабрика блока, меняется вместе с его зависимостями (useCallback у вызывающего).
  }, [on, create]);
}
