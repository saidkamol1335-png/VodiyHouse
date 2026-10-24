"use client";

import { type ReactNode, type RefObject, useEffect, useState } from "react";

type CalcStickyBarProps = {
  /** Итог расчёта: пока он на экране, полоса не нужна. */
  watch: RefObject<HTMLElement | null>;
  label: string;
  value: string | null;
  /** Кнопка справа: «Скопировать для Telegram» в кабинете, «К расчёту ↓» на странице. */
  action: ReactNode;
};

/** Итог на экране — полосу прячем; без IntersectionObserver (старый браузер) — полоса видна. */
function useOffscreen(watch: RefObject<HTMLElement | null>): boolean {
  const [offscreen, setOffscreen] = useState(true);
  useEffect(() => {
    const target = watch.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry?.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);
  return offscreen;
}

/**
 * Липкая полоса «Платёж в месяц» на телефоне (В7 B, мокап MobFlat): платёж и кнопка; прячется,
 * когда итог на экране, — иначе платёж был бы в ~1700 px от ползунка взноса.
 */
export function CalcStickyBar({ watch, label, value, action }: CalcStickyBarProps) {
  const offscreen = useOffscreen(watch);
  if (value === null) return null;
  return (
    <div
      className="calc-sticky-bar"
      data-hidden={offscreen ? undefined : ""}
      // Итог на экране — полоса уехала: ни диктору, ни клавиатуре её кнопка не нужна.
      inert={!offscreen}
    >
      <p className="calc-sticky-bar__text">
        <span className="calc-sticky-bar__label">{label}</span>
        <b className="calc-sticky-bar__value">{value}</b>
      </p>
      {action}
    </div>
  );
}
