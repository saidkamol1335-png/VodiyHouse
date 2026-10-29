"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ANCHOR_START_ATTRIBUTE, SCROLL_MEMORY_KEY } from "@/lib/boot/anchorStart";

/** Прокручена ли страница: метка в начале документа ушла из виду — шапка становится стеклом. */
export function useScrolledPast() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // Прокрутку при уходе — для скрипта в <head>: после перезагрузки браузер вернёт её до гидратации.
    const remember = () => {
      try {
        sessionStorage.setItem(
          SCROLL_MEMORY_KEY + location.pathname,
          String(Math.round(window.scrollY)),
        );
      } catch {
        // Хранилище недоступно — шапка просто узнает о прокрутке после гидратации.
      }
    };
    window.addEventListener("pagehide", remember);
    return () => window.removeEventListener("pagehide", remember);
  }, []);
  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry?.isIntersecting);
      // Шапка знает, где страница, — метка «открыта по якорю» из <head> больше не нужна.
      document.documentElement.removeAttribute(ANCHOR_START_ATTRIBUTE);
    });
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
