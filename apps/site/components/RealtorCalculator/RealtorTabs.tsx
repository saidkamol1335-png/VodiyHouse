"use client";

import type { KeyboardEvent } from "react";
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
 * Вкладки «Ипотека · Рассрочка · Сколько могу купить» (образец uysot.uz): настоящий tablist —
 * стрелки ← → и Home / End переключают и переводят фокус, в порядке Tab — только выбранная.
 */
export function RealtorTabs({ id, label, value, labels, onChange }: RealtorTabsProps) {
  const pick = (mode: RealtorMode) => {
    onChange(mode);
    document.getElementById(tabId(id, mode))?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = REALTOR_MODES.indexOf(value);
    const last = REALTOR_MODES.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    pick(REALTOR_MODES[next]!);
  };
  return (
    <div className="realtor-calc__tabs" role="tablist" aria-label={label}>
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
