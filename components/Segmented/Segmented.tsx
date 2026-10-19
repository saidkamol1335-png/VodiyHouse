import type { ReactNode } from "react";

type SegmentedProps = {
  label: string;
  children: ReactNode;
  /** sm — шапка (27 px), lg — меню телефона на всю ширину (44 px). */
  size?: "sm" | "lg";
};

/** Сегмент из двух-трёх вариантов: RU | UZ, Светлая | Тёмная. */
export function Segmented({ label, children, size = "sm" }: SegmentedProps) {
  return (
    <div className={`segmented segmented--${size}`} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Класс варианта: сам вариант — ссылка или кнопка, решает тот, кто знает, что он делает. */
export function segmentedItemClass(active: boolean): string {
  return active ? "segmented__item segmented__item--active" : "segmented__item";
}
