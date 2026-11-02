"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";
import { SWITCHING_ATTRIBUTE } from "@/lib/admin/units/switching";

/**
 * Переход на другой блок идёт (RSC нового блока, а если сохранение сбросило тег ЖК — и refresh):
 * точка у ссылки, а уходящий блок приглушён и недоступен целиком — с массовой панелью и полосой
 * внизу, мышью и клавиатурой (inert; Ctrl+Z молчит по data-switching вкладки): правку, начатую
 * в нём, унёс бы переход. Точка у ссылки в DOM всегда (у текущего блока её нет) — меняется только
 * прозрачность.
 */
export function SwitchPending() {
  const { pending } = useLinkStatus();
  const dot = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!pending) return;
    const tab = dot.current?.closest<HTMLElement>("[data-units-tab]") ?? null;
    const hosts = [...(tab?.querySelectorAll<HTMLElement>("[data-units-dock-host]") ?? [])];
    tab?.setAttribute(SWITCHING_ATTRIBUTE, "");
    for (const host of hosts) host.inert = true;
    return () => {
      tab?.removeAttribute(SWITCHING_ATTRIBUTE);
      for (const host of hosts) host.inert = false;
    };
  }, [pending]);
  const on = pending ? " units-block-switch__pending--on" : "";
  return <span ref={dot} className={`units-block-switch__pending${on}`} aria-hidden="true" />;
}
