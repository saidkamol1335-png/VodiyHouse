"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/IconButton";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { setTheme, useTheme } from "@/lib/theme";

const ICON = { size: 20, strokeWidth: 1.7 } as const;

/** ☾ / ☀ в шапке: показывает ту тему, на которую переключит. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("header");
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? t("themeToLight") : t("themeToDark");
  return (
    <IconButton label={label} onClick={toggleTheme} className={className}>
      {theme === "dark" ? <Sun {...ICON} aria-hidden /> : <Moon {...ICON} aria-hidden />}
    </IconButton>
  );
}

/** «Светлая | Тёмная» на всю ширину — меню телефона. */
export function ThemeSegmented() {
  const t = useTranslations("header");
  const { theme } = useTheme();
  return (
    <Segmented label={t("theme")} size="lg">
      <button type="button" className={segmentedItemClass(theme === "light")} aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
        <Sun size={16} strokeWidth={1.8} aria-hidden />
        {t("themeLight")}
      </button>
      <button type="button" className={segmentedItemClass(theme === "dark")} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
        <Moon size={16} strokeWidth={1.8} aria-hidden />
        {t("themeDark")}
      </button>
    </Segmented>
  );
}
