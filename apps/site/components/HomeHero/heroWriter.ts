import type { Pose } from "@/lib/site/home/heroRise";

type Box = Partial<Record<"left" | "top" | "width" | "height", number>> & { display?: string };

/**
 * Запись в стили листьев первого экрана только при изменении: строка transform и opacity сравнивается
 * с прошлой — в кадре браузер получает 6–10 записей, а не все слои подряд. reset() снимает всё, что
 * записал писатель (смена режима, уход со страницы).
 */
export class HeroWriter {
  private readonly cache = new Map<HTMLElement, Map<string, string>>();

  pose(element: HTMLElement, { tx, ty, s, o }: Pose): void {
    // «none», а не пусто: у рамок CSS по умолчанию прячет их за горизонтом, пустая строка вернула бы его.
    const transform =
      tx === 0 && ty === 0 && s === 1
        ? "none"
        : `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    this.style(element, "transform", transform);
    this.style(element, "opacity", o >= 1 ? "" : o.toFixed(3));
  }

  box(element: HTMLElement, box: Box): void {
    for (const [key, value] of Object.entries(box) as [keyof Box, number | string][])
      this.style(element, key, typeof value === "number" ? `${value.toFixed(1)}px` : value);
  }

  style(element: HTMLElement, property: string, value: string): void {
    let props = this.cache.get(element);
    if (!props) {
      props = new Map();
      this.cache.set(element, props);
    }
    if (props.get(property) === value) return;
    props.set(property, value);
    element.style.setProperty(kebab(property), value);
  }

  reset(): void {
    for (const [element, props] of this.cache)
      for (const property of props.keys()) element.style.removeProperty(kebab(property));
    this.cache.clear();
  }
}

const kebab = (property: string) => property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
