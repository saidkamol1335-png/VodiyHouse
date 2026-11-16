"use client";

import { type RefObject, useEffect } from "react";

/** Значения образца: отступ превью от правого нижнего угла, метка «Далее» — у угла превью. */
const CORNER_INSET = 28;
const LABEL_OFFSET = 8;

type CornerRefs = { root: RefObject<HTMLElement | null>; thumb: RefObject<HTMLElement | null>; label: RefObject<HTMLElement | null> };

/** Превью — в правый нижний угол, метка — у его угла (элементы двигает только этот кадр раскладки). */
function placeThumb(host: HTMLElement, box: HTMLElement, tag: HTMLElement) {
  const x = host.clientWidth - box.offsetWidth - CORNER_INSET;
  const y = host.clientHeight - box.offsetHeight - CORNER_INSET;
  box.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  tag.style.transform = `translate3d(${x + LABEL_OFFSET}px, ${y + LABEL_OFFSET}px, 0)`;
}

/**
 * Превью следующего кадра и метка «Далее» — в правом нижнем углу галереи (как образец в покое).
 * До правок 15.11 превью шло за курсором и любой клик листал; теперь нажатие на фото открывает его
 * во весь экран (п. 15), а листает только само превью — поэтому оно стоит на месте.
 */
export function useThumbFollow({ root, thumb, label }: CornerRefs, enabled: boolean): void {
  useEffect(() => {
    const host = root.current;
    const box = thumb.current;
    const tag = label.current;
    if (!enabled || !host || !box || !tag) return;
    const place = () => placeThumb(host, box, tag);
    place();
    const sizes = new ResizeObserver(place);
    sizes.observe(host);
    return () => sizes.disconnect();
  }, [root, thumb, label, enabled]);
}
