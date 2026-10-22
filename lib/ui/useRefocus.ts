"use client";

import { useEffect, useRef } from "react";

/**
 * Кнопка отправки на время запроса недоступна — фокус с неё падает на body. Запрос кончился, а
 * фокус так никуда и не ушёл — вернуть его на кнопку: форма открыта, работа с ней продолжается.
 * Нажимали что-то, пока шёл запрос (в Safari клик фокуса не ставит), — фокус не трогаем.
 */
export function useRefocusAfter(pending: boolean) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending) return;
    // Кнопка — тот же узел всё время запроса; форму закрыли — узел вне DOM, focus() ничего не делает.
    const element = button.current;
    let touched = false;
    const touch = () => (touched = true);
    document.addEventListener("pointerdown", touch, true);
    return () => {
      document.removeEventListener("pointerdown", touch, true);
      const lost = document.activeElement === document.body || document.activeElement === null;
      if (!touched && lost) element?.focus({ preventScroll: true });
    };
  }, [pending]);
  return button;
}
