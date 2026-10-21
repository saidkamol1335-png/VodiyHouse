"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { UNIT_STATUSES, type UnitStatus } from "@/lib/units";

type UnitStatusPickerProps = {
  number: string;
  status: UnitStatus;
  onPick: (status: UnitStatus) => void;
  /** Esc — закрыть без смены (фокус вернёт тот, кто открыл). */
  onClose: () => void;
};

/**
 * Три статуса кнопками (решение №7): раскрываются под строкой по тапу на плашку — как чипы
 * статуса заявки в мокапе. Фокус сразу на первом другом статусе: Enter меняет, Esc закрывает.
 * В 12.5 тот же выбор встанет в массовую панель.
 */
export function UnitStatusPicker({ number, status, onPick, onClose }: UnitStatusPickerProps) {
  const t = useTranslations("admin.journal.unitStatus");
  const tList = useTranslations("admin.complexes.units.list");
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  };
  const firstOther = UNIT_STATUSES.find((item) => item !== status);
  return (
    <div
      className="unit-status-picker"
      role="group"
      aria-label={tList("statusPicker", { number })}
      onKeyDown={keydown}
    >
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
