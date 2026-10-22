"use client";

import { useLinkStatus } from "next/link";

/**
 * Переход на другой блок идёт (тап статуса ещё сохраняется — Next ждёт его и refresh): точка у
 * ссылки, а уходящий блок приглушён и не принимает клики (ComplexUnitsTab.css, :has), чтобы
 * правку не начали в нём. Точка всегда в DOM — меняется только прозрачность, вёрстка не прыгает.
 */
export function SwitchPending() {
  const { pending } = useLinkStatus();
  const on = pending ? " units-block-switch__pending--on" : "";
  return <span className={`units-block-switch__pending${on}`} aria-hidden="true" />;
}
