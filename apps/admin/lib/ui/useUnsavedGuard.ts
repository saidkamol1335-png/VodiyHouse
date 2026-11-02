"use client";

import { useCallback, useEffect, useState } from "react";

// «Уйти без сохранения?» у вкладок ЖК с кнопкой «Сохранить вкладку» («реши сам» шага 11): и при
// закрытии или обновлении страницы, и при переходе по ссылке кабинета (вкладки, меню) — Next.js
// сам переходы не останавливает, поэтому ссылку ловим до него. «Назад» браузера и жест «назад» —
// мягкий переход по истории без beforeunload: его спрашивает Navigation API, где браузер даёт
// отменить переход (Chrome, Edge); в остальных черновик держит сам Next.js (Activity, 3 адреса).

type NavigateEventLike = Event & { navigationType?: string };

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
    // Только переходы по истории: ссылки уже спросил click, обновление — beforeunload.
    const navigate = (event: Event) => {
      const { navigationType, cancelable } = event as NavigateEventLike;
      if (navigationType !== "traverse" || !cancelable) return;
      if (!window.confirm(message)) event.preventDefault();
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, [dirty, message]);

  // Стабильные: reset стоит в зависимостях эффекта «после „Сохранено“» у формы.
  const onInput = useCallback(() => setDirty(true), []);
  const reset = useCallback(() => setDirty(false), []);
  /** onInput — на форму: что-то поменяли; reset — после «Сохранено». */
  return { dirty, onInput, reset };
}
