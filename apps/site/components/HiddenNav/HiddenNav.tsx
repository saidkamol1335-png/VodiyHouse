"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { NavKey } from "@/lib/routes";

// Пункты меню, которых сейчас нет на сайте: «Калькулятор» без застройщиков с программами (решение
// фазы 2 «Пустые состояния»). Знает layout сайта (данные), шапка и оба меню только фильтруют.

const HiddenNavContext = createContext<readonly NavKey[]>([]);

export function HiddenNavProvider({
  hidden,
  children,
}: {
  hidden: readonly NavKey[];
  children: ReactNode;
}) {
  return <HiddenNavContext.Provider value={hidden}>{children}</HiddenNavContext.Provider>;
}

export function useNavItems<T extends { key: NavKey }>(items: readonly T[]): T[] {
  const hidden = useContext(HiddenNavContext);
  return items.filter((item) => !hidden.includes(item.key));
}
