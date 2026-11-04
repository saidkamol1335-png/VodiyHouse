"use client";

import { type CSSProperties, type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { REALTOR_MODES, type RealtorMode } from "@vh/shared/calc/realtor";

type RealtorTabsProps = {
  id: string;
  label: string;
  value: RealtorMode;
  labels: Readonly<Record<RealtorMode, string>>;
  onChange: (mode: RealtorMode) => void;
};

export const tabId = (id: string, mode: RealtorMode) => `${id}-tab-${mode}`;
export const panelId = (id: string) => `${id}-panel`;

/**
 * Подложка выбранной вкладки (PLAN §10, п. 49): переезжает к новой — translateX и scaleX от меры
 * кнопки. До меры (и без JS) подложку рисует сама выбранная вкладка.
 */
/** ← → по кругу, Home / End — крайние; другая клавиша — null. */
function nextTab(value: RealtorMode, key: string): RealtorMode | null {
  const index = REALTOR_MODES.indexOf(value);
  const last = REALTOR_MODES.length - 1;
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[key];
  return next === undefined ? null : REALTOR_MODES[next]!;
}

const Indicator = ({ x, width }: { x: number; width: number }) => (
  <span
    className="realtor-calc__tab-indicator"
    aria-hidden="true"
    style={{ "--tab-x": `${x}px`, "--tab-scale": width / 100 } as CSSProperties}
  />
);

function useIndicator(value: RealtorMode) {
  const list = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const measure = () => {
      const tab = root.querySelector<HTMLElement>('[aria-selected="true"]');
      if (tab) setBox({ x: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    // Кнопки — тоже: шрифт догрузился, ширины вкладок сменились, а растянутый список (телефон) — нет.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('[role="tab"]').forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [value]);
  return { list, box };
}

/**
 * Вкладки «Ипотека · Рассрочка · Сколько могу купить» (образец uysot.uz): настоящий tablist —
 * стрелки ← → и Home / End переключают и переводят фокус, в порядке Tab — только выбранная.
 */
export function RealtorTabs({ id, label, value, labels, onChange }: RealtorTabsProps) {
  const { list, box } = useIndicator(value);
  const pick = (mode: RealtorMode) => {
    onChange(mode);
    document.getElementById(tabId(id, mode))?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = nextTab(value, event.key);
    if (!next) return;
    event.preventDefault();
    pick(next);
  };
  return (
    <div
      ref={list}
      className={box ? "realtor-calc__tabs realtor-calc__tabs--measured" : "realtor-calc__tabs"}
      role="tablist"
      aria-label={label}
    >
      {box ? <Indicator {...box} /> : null}
      {REALTOR_MODES.map((mode) => {
        const selected = mode === value;
        return (
          <button
            key={mode}
            id={tabId(id, mode)}
            type="button"
            role="tab"
            className={selected ? "realtor-calc__tab realtor-calc__tab--active" : "realtor-calc__tab"}
            aria-selected={selected}
            aria-controls={panelId(id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(mode)}
            onKeyDown={onKeyDown}
          >
            {labels[mode]}
          </button>
        );
      })}
    </div>
  );
}
