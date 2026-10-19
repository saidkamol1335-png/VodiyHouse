"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME, getTheme, setTheme, THEME_ATTRIBUTE, type Theme } from "./theme";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: [THEME_ATTRIBUTE] });
  return () => observer.disconnect();
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, () => getTheme(), () => DEFAULT_THEME);
  const toggleTheme = useCallback(() => setTheme(getTheme() === "dark" ? "light" : "dark"), []);
  return { theme, toggleTheme };
}
