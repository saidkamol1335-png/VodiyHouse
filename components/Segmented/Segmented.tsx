import type { ReactNode } from "react";

type SegmentedProps = {
  label: string;
  children: ReactNode;
  /** sm — шапка (27 px), lg — меню телефона на всю ширину (44 px). */
  size?: "sm" | "lg";
  /** Элемент блока-владельца (БЭМ-примесь): раскладку сегмента в своей строке задаёт он. */
  className?: string;
};

/** Сегмент из двух-трёх вариантов: RU | UZ, Светлая | Тёмная. */
export function Segmented({ label, children, size = "sm", className }: SegmentedProps) {
  const classes = `segmented segmented--${size}${className ? ` ${className}` : ""}`;
  return (
    <div className={classes} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Класс варианта: сам вариант — ссылка или кнопка, решает тот, кто знает, что он делает. */
export function segmentedItemClass(active: boolean): string {
  return active ? "segmented__item segmented__item--active" : "segmented__item";
}
