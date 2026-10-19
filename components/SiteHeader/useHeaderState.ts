"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MENU_OPEN_CLASS = "has-open-menu";

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

/** Меню: открыть / закрыть, Escape, без прокрутки страницы под полноэкранным меню телефона. */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const toggleButton = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add(MENU_OPEN_CLASS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleButton.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.classList.remove(MENU_OPEN_CLASS);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, close, toggle, toggleButton };
}
