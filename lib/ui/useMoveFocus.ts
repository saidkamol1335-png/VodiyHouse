"use client";

import { useEffect, useRef } from "react";

export type MoveDirection = "up" | "down";

/**
 * Стрелки порядка (блоки ЖК, программы оплаты): после переноса узла фокус уходит на body —
 * возвращаем на ту же стрелку, а если она стала недоступной (карточка на краю) — на соседнюю.
 */
export function useMoveFocus(focusMove: MoveDirection | undefined, onFocused: () => void) {
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusMove) return;
    const [target, fallback] = focusMove === "up" ? [up, down] : [down, up];
    (target.current && !target.current.disabled ? target : fallback).current?.focus();
    onFocused();
  }, [focusMove, onFocused]);
  return [up, down] as const;
}
