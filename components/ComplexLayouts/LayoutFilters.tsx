"use client";

import { useTranslations } from "next-intl";
import type { LayoutFilter } from "@/lib/site/complex/layouts";

type LayoutFiltersProps = {
  options: { blocks: { id: string; name: string }[]; rooms: number[] };
  filter: LayoutFilter;
  onChange: (filter: LayoutFilter) => void;
};

type Option<Value> = { value: Value; label: string };

type SegmentProps<Value> = {
  modifier: "blocks" | "rooms";
  label: string;
  options: readonly Option<Value>[];
  value: Value;
  onPick: (value: Value) => void;
};

/** Сегмент фильтра (мокап .seg): «Все» и варианты, выбран один. */
function Segment<Value>({ modifier, label, options, value, onPick }: SegmentProps<Value>) {
  return (
    <div className={`complex-layouts__segment complex-layouts__segment--${modifier}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={option.value === value ? "complex-layouts__option complex-layouts__option--active" : "complex-layouts__option"}
          aria-pressed={option.value === value}
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Фильтры «Планировок» (мокап .plan-filters, .seg): блок — если их несколько, комнаты — какие есть. */
export function LayoutFilters({ options, filter, onChange }: LayoutFiltersProps) {
  const t = useTranslations("complex");
  const roomsLabel = (rooms: number) => (rooms <= 4 ? t(`rooms.${rooms as 0 | 1 | 2 | 3 | 4}`) : t("rooms.more", { n: rooms }));
  if (options.blocks.length === 0 && options.rooms.length === 0) return null;
  const blocks: Option<string | null>[] = [
    { value: null, label: t("layouts.allBlocks") },
    ...options.blocks.map((block) => ({ value: block.id, label: t("layouts.block", { name: block.name }) })),
  ];
  const rooms: Option<number | null>[] = [
    { value: null, label: t("layouts.allRooms") },
    ...options.rooms.map((count) => ({ value: count, label: roomsLabel(count) })),
  ];
  return (
    <div className="complex-layouts__filters">
      {options.blocks.length > 0 ? (
        <Segment modifier="blocks" label={t("layouts.blocksLabel")} options={blocks} value={filter.blockId} onPick={(blockId) => onChange({ blockId, rooms: null })} />
      ) : null}
      {options.rooms.length > 0 ? (
        <Segment modifier="rooms" label={t("layouts.roomsLabel")} options={rooms} value={filter.rooms} onPick={(count) => onChange({ ...filter, rooms: count })} />
      ) : null}
    </div>
  );
}
