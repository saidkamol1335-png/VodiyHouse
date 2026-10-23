"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Прокручена ли страница: метка в начале документа ушла из виду — шапка становится стеклом. */
export function useScrolledPast() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { sentinel, scrolled };
}

/** Меню: открыть / закрыть, Escape. Прокрутку под меню телефона гасит CSS (PhoneMenu.css). */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const toggleButton = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleButton.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, close, toggle, toggleButton };
}
