"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Блок в «одном экране» от вьюпорта (или уже в нём): с этого момента грузим тяжёлое — кадры,
 * Three.js. Раз став true, не сбрасывается.
 */
export function useNear(ref: RefObject<Element | null>, margin = "100% 0px"): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, margin, near]);
  return near;
}
