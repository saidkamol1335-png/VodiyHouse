// Тема кабинета и свёрнутое меню (скин 04.11.2026, styles/skin-admin.css). Выбор — в localStorage
// этого браузера; скрипт в <head> (headScript.ts) ставит атрибуты до первой отрисовки, иначе
// сохранённая тёмная тема и узкое меню мигали бы светлой и широким.

export const THEME_STORAGE_KEY = "vh-admin-theme";
export const THEME_ATTRIBUTE = "data-theme";
export type AdminTheme = "light" | "dark";

export const SIDE_STORAGE_KEY = "vh-admin-side";
export const SIDE_ATTRIBUTE = "data-side";
export const SIDE_COLLAPSED = "collapsed";

export function isAdminTheme(value: unknown): value is AdminTheme {
  return value === "light" || value === "dark";
}
