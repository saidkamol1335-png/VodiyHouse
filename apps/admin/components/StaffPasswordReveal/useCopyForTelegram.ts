"use client";

import { useEffect, useRef, useState } from "react";

export type CopyState = "idle" | "copied" | "failed";

/**
 * Копирование сообщения для Telegram. Буфер недоступен (старый браузер, нет разрешения) —
 * текст показывается в поле и выделяется: Ctrl+C сработает сразу.
 */
export function useCopyForTelegram(message: () => string) {
  const [state, setState] = useState<CopyState>("idle");
  const fallback = useRef<HTMLTextAreaElement>(null);

  // select() сам фокус не переводит — сначала focus().
  useEffect(() => {
    if (state !== "failed") return;
    fallback.current?.focus();
    fallback.current?.select();
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message());
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return { state, copy, fallback };
}
