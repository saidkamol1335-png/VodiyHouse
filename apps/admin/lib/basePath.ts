// Кабинет под префиксом адреса — только локально: `npm run dev` в корне поднимает сайт и кабинет на одном
// http://localhost:3000, кабинет — на /admin (ADMIN_BASE_PATH, next.config.ts). В проде префикса нет:
// кабинет — свой домен. Link, redirect и статика Next добавляют префикс сами; обычные <a> и адреса
// в proxy — через withBasePath.
export const BASE_PATH = process.env.ADMIN_BASE_PATH ?? "";

/** Адрес кабинета от корня ("/vhod") — с префиксом; внешние адреса не трогает. */
export function withBasePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? `${BASE_PATH}${path}` : path;
}
