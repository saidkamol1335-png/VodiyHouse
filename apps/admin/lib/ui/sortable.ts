// Порядок перетаскиванием (решения Д5, Д6): чистые расчёты для useSortable — куда встанет строка.

/** Новый массив: элемент from переезжает на место to, остальные сдвигаются. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved as T);
  return next;
}

/**
 * Куда встать перетаскиваемой строке: столько строк, сколько чужих середин выше пальца.
 * midpoints — середины строк по вертикали в текущем порядке, включая перетаскиваемую (from).
 */
export function dropIndex(midpoints: readonly number[], from: number, pointerY: number): number {
  return midpoints.filter((middle, index) => index !== from && middle < pointerY).length;
}
