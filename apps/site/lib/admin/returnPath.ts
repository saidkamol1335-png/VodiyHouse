import { ADMIN_ROUTE } from "@/lib/routes";

// Куда вернуть после входа (ссылка «Взять в работу: …/admin/zayavki/1045» из чата менеджеров,
// ТЗ 10.4): proxy запоминает адрес в короткой cookie, вход ведёт туда, а не на главную роли.
// Только свои пути кабинета: чужой домен, «//…» и «\…» — не адрес возврата.

export const RETURN_COOKIE = "vh-return";
export const RETURN_MAX_AGE_SECONDS = 10 * 60;
const MAX_LENGTH = 300;
const LOGIN_PATH = `${ADMIN_ROUTE}/vhod`;
const SAFE_PATH = /^\/admin(?:\/[A-Za-z0-9_\-/]*)?(?:\?[A-Za-z0-9_\-=&%.+]*)?$/;

/** Адрес возврата или null: путь кабинета (не экран входа) без чужого хоста. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_LENGTH || !SAFE_PATH.test(value) || value.includes("//")) return null;
  const pathname = value.split("?")[0]!;
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) return null;
  return value;
}
