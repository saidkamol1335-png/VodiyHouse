import { ADMIN_ROUTE } from "@/lib/routes";

// Ранняя проверка кабинета в proxy.ts — только оптимистичная (без базы): есть ли сессия.
// Права решают страницы кабинета (lib/admin/session.ts) и RLS.

const LOGIN_PATH = `${ADMIN_ROUTE}/vhod`;

/** /admin и всё под ним; /administrator и /uz/admin — не кабинет. */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_ROUTE || pathname.startsWith(`${ADMIN_ROUTE}/`);
}

// Cookie сессии @supabase/ssr: sb-<ref>-auth-token, длинная делится на .0, .1, …
const AUTH_COOKIE = /^sb-[^.]+-auth-token(\.\d+)?$/;

export function hasAuthCookie(cookieNames: readonly string[]): boolean {
  return cookieNames.some((name) => AUTH_COOKIE.test(name));
}

export type GateDecision = { kind: "next" } | { kind: "redirect"; location: string };

/**
 * Экран входа открыт всегда; Server Action не перенаправляется (307 на POST сломал бы действие —
 * оно само проверяет сотрудника); без сессии — на вход.
 */
export function adminGate(input: { pathname: string; hasSession: boolean; isServerAction: boolean }): GateDecision {
  if (input.isServerAction || input.pathname === LOGIN_PATH || input.hasSession) return { kind: "next" };
  return { kind: "redirect", location: LOGIN_PATH };
}
