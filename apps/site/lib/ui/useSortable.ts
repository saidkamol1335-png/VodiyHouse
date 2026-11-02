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

const arrowStep = (key: string) => (key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0);

/** Ручка переехала вместе со строкой — фокус на неё после перерисовки. */
function focusHandleLater(list: RefObject<HTMLElement | null>, index: number) {
  requestAnimationFrame(() =>
    list.current?.querySelectorAll<HTMLElement>("[data-sortable-handle]")[index]?.focus(),
  );
}

/** Какую строку тянут и порядок после последнего сдвига; при отпускании его и сохраняют. */
function useDragOrder<T>({ items, onReorder, onDrop }: Omit<UseSortableParams<T>, "list">) {
  const dragging = useRef<number | null>(null);
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
  const start = (index: number) => {
    dragging.current = index;
    moved.current = null;
    setActive(index);
  };
  /** Стрелка — не перетаскивание: следующее движение мыши строку не тянет. */
  const step = (index: number, to: number) => {
    const next = move(index, to);
    moved.current = null;
    dragging.current = null;
    if (next) onDrop?.(next);
  };
  return { active, from: () => dragging.current, move, start, finish, step };
}

export function useSortable<T>({ items, onReorder, onDrop, list }: UseSortableParams<T>) {
  const drag = useDragOrder({ items, onReorder, onDrop });
  const handleProps = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.start(index);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const from = drag.from();
      if (from === null) return;
      drag.move(from, dropIndex(middlesOf(list.current), from, event.clientY));
    },
    onPointerUp: drag.finish,
    onPointerCancel: drag.finish,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const step = arrowStep(event.key);
      if (!step) return;
      event.preventDefault();
      drag.step(index, index + step);
      focusHandleLater(list, index + step);
    },
    "data-sortable-handle": "",
  });
  return { handleProps, activeIndex: drag.active };
}
