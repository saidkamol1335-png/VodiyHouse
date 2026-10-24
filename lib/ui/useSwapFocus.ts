"use client";

import { useEffect, useRef } from "react";

/**
 * Кнопка открывает на своём месте подтверждение или форму («Удалить» → «Да, удалить»,
 * «Зафиксировать курс» → поле): фокус уходит в открывшееся, после «Отмена» — обратно на кнопку,
 * а не на body (кнопка-то исчезала из DOM).
 */
export function useSwapFocus<Target extends HTMLElement = HTMLButtonElement>(open: boolean) {
  const trigger = useRef<HTMLButtonElement>(null);
  const target = useRef<Target>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      target.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      trigger.current?.focus();
    }
  }, [open]);
  return { trigger, target };
}
