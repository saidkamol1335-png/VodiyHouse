"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";

/**
 * Переход на другой блок идёт (тап статуса ещё сохраняется — Next ждёт его и refresh): точка у
 * ссылки, а уходящий блок приглушён и недоступен целиком — с массовой панелью и полосой внизу,
 * мышью и клавиатурой (inert; Ctrl+Z молчит по data-switching вкладки): правку, начатую в нём,
 * унёс бы переход. Точка всегда в DOM — меняется только прозрачность, вёрстка не прыгает.
 */
export function SwitchPending() {
  const { pending } = useLinkStatus();
  const dot = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!pending) return;
    const tab = dot.current?.closest<HTMLElement>("[data-units-tab]") ?? null;
    const hosts = [...(tab?.querySelectorAll<HTMLElement>("[data-units-dock-host]") ?? [])];
    tab?.setAttribute("data-switching", "");
    for (const host of hosts) host.inert = true;
    return () => {
      tab?.removeAttribute("data-switching");
      for (const host of hosts) host.inert = false;
    };
  }, [pending]);
  const on = pending ? " units-block-switch__pending--on" : "";
  return <span ref={dot} className={`units-block-switch__pending${on}`} aria-hidden="true" />;
}
