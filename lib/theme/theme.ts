// Тема: светлая основная, тёмная — переключателем ☾/☀ (PLAN §3.7).
// Хранится в localStorage, а не в cookie: так страницы остаются статичными.

export type Theme = "light" | "dark";

export const THEME_ATTRIBUTE = "data-theme";
export const THEME_STORAGE_KEY = "vh-theme";
export const DEFAULT_THEME: Theme = "light";

export function getTheme(doc: Document = document): Theme {
  return doc.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark" ? "dark" : DEFAULT_THEME;
}

export function setTheme(theme: Theme, win: Window = window): void {
  win.document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  try {
    win.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // без хранилища тема продержится до перезагрузки
  }
}
