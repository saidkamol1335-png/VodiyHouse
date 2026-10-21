"use client";

import { useFormatter } from "next-intl";
import { useRef } from "react";
import { useStripScroll } from "@/lib/ui/useStripScroll";

type FilterPill<Key extends string> = { key: Key; label: string; count?: number };

type FilterPillsProps<Key extends string> = {
  label: string;
  pills: readonly FilterPill<Key>[];
  value: Key;
  onChange: (key: Key) => void;
};

/** Пилюли-фильтры над списком (мокап: «Все застройщики» в «Программах оплаты»): одна выбрана. */
export function FilterPills<Key extends string>({
  label,
  pills,
  value,
  onChange,
}: FilterPillsProps<Key>) {
  const format = useFormatter();
  const track = useRef<HTMLDivElement>(null);
  // Затухание у края, за которым ещё есть пилюли, — как у вкладок (лента на телефоне).
  const edges = useStripScroll(track, true, value);
  return (
    <div
      ref={track}
      className="filter-pills"
      role="group"
      aria-label={label}
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
    >
      {pills.map((pill) => {
        const active = pill.key === value;
        return (
          <button
            key={pill.key}
            type="button"
            className={
              active ? "filter-pills__pill filter-pills__pill--active" : "filter-pills__pill"
            }
            aria-pressed={active}
            onClick={() => onChange(pill.key)}
          >
            {pill.label}
            {pill.count === undefined ? null : (
              <span className="filter-pills__count">{format.number(pill.count)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
