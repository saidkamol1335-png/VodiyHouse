"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { dropIndex, moveItem } from "./sortable";

// Порядок строк перетаскиванием за ручку (решения Д5, Д6): мышь и палец — pointer events,
// клавиатура — стрелки ↑ ↓ на ручке. Строки ищутся в списке по data-sortable-row.

type UseSortableParams<T> = {
  items: readonly T[];
  onReorder: (next: T[]) => void;
  /** Строку отпустили на новом месте (или сдвинули стрелкой) — сохранить порядок сразу. */
  onDrop?: (next: T[]) => void;
  list: RefObject<HTMLElement | null>;
};

function middlesOf(list: HTMLElement | null): number[] {
  if (!list) return [];
  return Array.from(list.querySelectorAll<HTMLElement>("[data-sortable-row]"), (row) => {
    const box = row.getBoundingClientRect();
    return box.top + box.height / 2;
  });
}

export function useSortable<T>({ items, onReorder, onDrop, list }: UseSortableParams<T>) {
  const dragging = useRef<number | null>(null);
  // Порядок после последнего сдвига: при отпускании его и сохраняют.
  const moved = useRef<T[] | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const move = (from: number, to: number): T[] | null => {
    if (to === from || to < 0 || to >= items.length) return null;
    const next = moveItem(items, from, to);
    dragging.current = to;
    moved.current = next;
    setActive((current) => (current === null ? null : to));
    onReorder(next);
    return next;
  };

  const finish = () => {
    if (moved.current) onDrop?.(moved.current);
    moved.current = null;
    dragging.current = null;
    setActive(null);
  };

  const handleProps = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = index;
      moved.current = null;
      setActive(index);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const from = dragging.current;
      if (from === null) return;
      move(from, dropIndex(middlesOf(list.current), from, event.clientY));
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!step) return;
      event.preventDefault();
      const next = move(index, index + step);
      // Стрелка — не перетаскивание: следующее движение мыши строку не тянет.
      moved.current = null;
      dragging.current = null;
      if (next) onDrop?.(next);
      // Ручка переехала вместе со строкой — фокус остаётся на ней после перерисовки.
      requestAnimationFrame(() =>
        list.current
          ?.querySelectorAll<HTMLElement>("[data-sortable-handle]")
          [index + step]?.focus(),
      );
    },
    "data-sortable-handle": "",
  });

  return { handleProps, activeIndex: active };
}
