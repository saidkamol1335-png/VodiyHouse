"use client";

import { ChevronsLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { SIDE_ATTRIBUTE, SIDE_COLLAPSED, SIDE_STORAGE_KEY } from "@/lib/boot/theme";

/**
 * «Свернуть меню» внизу боковой панели (образец: «Hide» с ChevronsLeft): панель становится полосой
 * значков. Состояние — атрибут на <html> (его же ставит скрипт в <head>), подпись — по нему в CSS.
 */
export function SideToggle() {
  const t = useTranslations("admin.nav");

  const toggle = () => {
    const root = document.documentElement;
    const collapsed = root.getAttribute(SIDE_ATTRIBUTE) !== SIDE_COLLAPSED;
    if (collapsed) root.setAttribute(SIDE_ATTRIBUTE, SIDE_COLLAPSED);
    else root.removeAttribute(SIDE_ATTRIBUTE);
    try {
      if (collapsed) localStorage.setItem(SIDE_STORAGE_KEY, SIDE_COLLAPSED);
      else localStorage.removeItem(SIDE_STORAGE_KEY);
    } catch {
      // Хранилище недоступно — до перезагрузки.
    }
  };

  return (
    <button type="button" className="side-toggle" onClick={toggle}>
      <ChevronsLeft className="side-toggle__icon" size={18} strokeWidth={1.8} aria-hidden />
      <span className="side-toggle__label side-toggle__label--collapse">{t("collapse")}</span>
      <span className="side-toggle__label side-toggle__label--expand">{t("expand")}</span>
    </button>
  );
}
