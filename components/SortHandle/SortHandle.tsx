import { GripVertical } from "lucide-react";
import type { HTMLAttributes } from "react";

type SortHandleProps = HTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

/** Ручка порядка строки (Д5, Д6): тянуть мышью или пальцем, стрелки ↑ ↓ — с клавиатуры. */
export function SortHandle({ label, active = false, className, ...handle }: SortHandleProps) {
  const classes = ["sort-handle"];
  if (active) classes.push("sort-handle--active");
  // Микс владельца (место в строке) — вместе со своим классом, а не вместо него.
  if (className) classes.push(className);
  return (
    <button type="button" aria-label={label} {...handle} className={classes.join(" ")}>
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}
