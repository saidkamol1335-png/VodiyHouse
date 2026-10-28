"use client";

import { useEffect } from "react";
import { markHydrated } from "./hydrated";

/** Ставит data-hydrated на <html>, когда React ожил в браузере (lib/boot/hydrated.ts). Ничего не рисует. */
export function HydrationMark() {
  useEffect(() => {
    markHydrated();
  }, []);
  return null;
}
