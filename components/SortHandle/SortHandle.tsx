import { GripVertical } from "lucide-react";
import type { HTMLAttributes } from "react";

type SortHandleProps = HTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

/** Ручка порядка строки (Д5, Д6): тянуть мышью или пальцем, стрелки ↑ ↓ — с клавиатуры. */
export function SortHandle({ label, active = false, ...handle }: SortHandleProps) {
  return (
    <button
      type="button"
      className={active ? "sort-handle sort-handle--active" : "sort-handle"}
      aria-label={label}
      {...handle}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}
