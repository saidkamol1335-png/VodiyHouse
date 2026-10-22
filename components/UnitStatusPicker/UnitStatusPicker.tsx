"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { UNIT_STATUSES, type UnitStatus } from "@/lib/units";

type UnitStatusPickerProps = {
  /** Подпись группы для диктора: «Статус кв. 41», «Статус выбранных». */
  label: string;
  /** null — у выбранных статусы разные: ни одна кнопка не нажата. */
  status: UnitStatus | null;
  onPick: (status: UnitStatus) => void;
  /** Esc — закрыть без смены (фокус вернёт тот, кто открыл). */
  onClose: () => void;
};

/**
 * Три статуса кнопками (решение №7): раскрываются под строкой по тапу на плашку — как чипы
 * статуса заявки в мокапе. Фокус сразу на первом другом статусе: Enter меняет, Esc закрывает.
 * Тот же выбор — в массовой панели (12.5).
 */
export function UnitStatusPicker({ label, status, onPick, onClose }: UnitStatusPickerProps) {
  const t = useTranslations("admin.journal.unitStatus");
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  };
  const firstOther = UNIT_STATUSES.find((item) => item !== status);
  return (
    <div className="unit-status-picker" role="group" aria-label={label} onKeyDown={keydown}>
      {UNIT_STATUSES.map((item) => (
        <button
          key={item}
          ref={item === firstOther ? first : undefined}
          type="button"
          className={`unit-status-picker__option unit-status-picker__option--${item}`}
          aria-pressed={item === status}
          onClick={() => onPick(item)}
        >
          <span className="unit-status-picker__dot" aria-hidden="true" />
          {t(item)}
        </button>
      ))}
    </div>
  );
}
