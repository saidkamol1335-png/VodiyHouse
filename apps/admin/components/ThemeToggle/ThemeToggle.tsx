"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, isAdminTheme, type AdminTheme } from "@/lib/boot/theme";

const SYSTEM_DARK = "(prefers-color-scheme: dark)";

function storedTheme(): AdminTheme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isAdminTheme(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Светлая или тёмная тема кабинета (образец: луна в шапке). Тему до отрисовки ставит скрипт в <head>;
 * кнопка меняет атрибут и запоминает выбор. Значок — по атрибуту в CSS: сервер темы не знает.
 */
export function ThemeToggle() {
  const t = useTranslations("admin.nav");

  // Без своего выбора тема идёт за системой и после загрузки.
  useEffect(() => {
    const query = matchMedia(SYSTEM_DARK);
    const follow = () => {
      if (!storedTheme()) document.documentElement.setAttribute(THEME_ATTRIBUTE, query.matches ? "dark" : "light");
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next: AdminTheme = root.getAttribute(THEME_ATTRIBUTE) === "dark" ? "light" : "dark";
    root.setAttribute(THEME_ATTRIBUTE, next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Хранилище недоступно — тема сменится до перезагрузки.
    }
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={t("theme")} title={t("theme")}>
      <Moon className="theme-toggle__icon theme-toggle__icon--moon" size={18} strokeWidth={1.8} aria-hidden />
      <Sun className="theme-toggle__icon theme-toggle__icon--sun" size={18} strokeWidth={1.8} aria-hidden />
    </button>
  );
}
