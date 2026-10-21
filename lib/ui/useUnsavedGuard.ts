"use client";

import { useCallback, useEffect, useState } from "react";

// «Уйти без сохранения?» у вкладок ЖК с кнопкой «Сохранить вкладку» («реши сам» шага 11): и при
// закрытии или обновлении страницы, и при переходе по ссылке кабинета (вкладки, меню) — Next.js
// сам переходы не останавливает, поэтому ссылку ловим до него.

export function useUnsavedGuard(message: string) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const click = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, message]);

  // Стабильные: reset стоит в зависимостях эффекта «после „Сохранено“» у формы.
  const onInput = useCallback(() => setDirty(true), []);
  const reset = useCallback(() => setDirty(false), []);
  /** onInput — на форму: что-то поменяли; reset — после «Сохранено». */
  return { dirty, onInput, reset };
}
