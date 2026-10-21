"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { UnitsBarContext, type UnitsBar } from "@/lib/admin/units/bar";

/**
 * Полоса статуса — одна на вкладку «Квартиры», выше переключателя блоков: смена ?blok=
 * перерисовывает страницу, не пересоздавая её, и ответ тапа в блоке A виден и на блоке B.
 */
export function UnitsBarProvider({ children }: { children: ReactNode }) {
  const [bar, setBar] = useState<UnitsBar | null>(null);
  // Вкладку спрятали (Next держит её в Activity) — полоса не переживает показ: смена сохранена.
  useEffect(() => () => setBar(null), []);
  const value = useMemo(() => ({ bar, setBar }), [bar]);
  return <UnitsBarContext.Provider value={value}>{children}</UnitsBarContext.Provider>;
}
