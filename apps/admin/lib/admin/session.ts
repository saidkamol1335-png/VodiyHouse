import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEV_VIEWER,
  isCabinetOpenWithoutLogin,
  resolveViewer,
  type CabinetViewer,
  type OwnProfileRow,
  type StaffRole,
  type ViewerResult,
} from "./access";
import { DISABLED_LOGIN_PATH } from "./landing";
import { ADMIN_ROUTES, isSectionOpen, type AdminNavKey } from "./nav";

// Слой доступа кабинета (DAL): кто открыл страницу. Proxy проверяет только наличие сессии,
// а layout не перерисовывается при переходах — поэтому каждая страница и действие спрашивают здесь.

export type CabinetSession = { result: ViewerResult; email: string | null };

/**
 * Свой профиль под сессией сотрудника — функцией own_profile: флаг смены пароля в таблице виден только
 * о себе (аудит 29.10, 20261029070000). Ошибка сети — исключение.
 */
export async function readOwnProfile(supabase: SupabaseClient, userId: string): Promise<OwnProfileRow | null> {
  const { data, error } = await supabase.rpc("own_profile").maybeSingle();
  if (error) throw new Error("cabinet-profile-unavailable", { cause: error });
  const profile = data as OwnProfileRow | null;
  return profile?.id === userId ? profile : null;
}

/** Один раз на запрос (React.cache): layout, страница и меню читают одно и то же. */
export const getCabinetSession = cache(async (): Promise<CabinetSession> => {
  // Решение «без входа» и сессия — только во время запроса, не при сборке.
  await connection();
  if (isCabinetOpenWithoutLogin) return { result: { kind: "ok", viewer: DEV_VIEWER }, email: null };
  if (!hasSupabaseEnv()) return { result: { kind: "login" }, email: null };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  // Auth не ответил — app/admin/error.tsx покажет «Кабинет временно недоступен», а не вход.
  if (error?.name === "AuthRetryableFetchError") throw new Error("cabinet-auth-unavailable", { cause: error });
  const userId = data?.claims.sub ?? null;
  const profile = userId ? await readOwnProfile(supabase, userId) : null;
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;
  return { result: resolveViewer(userId, profile), email };
});

/** Сотрудник страницы кабинета; иначе редирект: на вход, на «доступ отключён» или на смену пароля. */
export async function requireViewer(options: { allowPasswordChange?: boolean } = {}): Promise<CabinetViewer> {
  const { result } = await getCabinetSession();
  switch (result.kind) {
    case "login":
      redirect(ADMIN_ROUTES.login);
    case "noAccess":
      redirect(DISABLED_LOGIN_PATH);
    case "changePassword":
      if (options.allowPasswordChange) return result.viewer;
      redirect(ADMIN_ROUTES.password);
    case "ok":
      return result.viewer;
  }
}

/** Сотрудник и открыт ли ему раздел (недоступное показывает «Раздел доступен руководителю»). */
export async function requireSection(key: AdminNavKey): Promise<{ viewer: CabinetViewer; allowed: boolean }> {
  const viewer = await requireViewer();
  return { viewer, allowed: isSectionOpen(viewer.role, key) };
}

export type ActionGuardCode = "notConfigured" | "session" | "forbidden" | "network";

export type ActionGuard =
  | { ok: true; viewer: CabinetViewer; email: string | null; supabase: SupabaseClient }
  | { ok: false; code: ActionGuardCode };

type CurrentUser = { id: string | null; email: string | null } | { code: "network" };

/** fresh — getUser() спрашивает Auth (видит отозванную сессию), иначе — подпись токена (getClaims). */
async function currentUser(supabase: SupabaseClient, fresh: boolean): Promise<CurrentUser> {
  if (fresh) {
    const { data, error } = await supabase.auth.getUser();
    if (error?.name === "AuthRetryableFetchError") return { code: "network" };
    return { id: data.user?.id ?? null, email: data.user?.email ?? null };
  }
  const { data, error } = await supabase.auth.getClaims();
  if (error?.name === "AuthRetryableFetchError") return { code: "network" };
  const claims = data?.claims;
  return { id: claims?.sub ?? null, email: typeof claims?.email === "string" ? claims.email : null };
}

/**
 * Первая строка каждого Server Action: действие — открытый POST, страница его не защищает.
 * Перед действиями с ключом service_role — fresh: true.
 */
export async function requireActionViewer(
  roles: readonly StaffRole[],
  options: { fresh?: boolean; allowPasswordChange?: boolean } = {},
): Promise<ActionGuard> {
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return { ok: false, code: "notConfigured" };
  const supabase = await createSupabaseServerClient();
  const user = await currentUser(supabase, options.fresh ?? false);
  if ("code" in user) return { ok: false, code: user.code };

  let profile: OwnProfileRow | null;
  try {
    profile = user.id ? await readOwnProfile(supabase, user.id) : null;
  } catch {
    return { ok: false, code: "network" };
  }
  const decision = decideActionGuard(resolveViewer(user.id, profile), roles, options.allowPasswordChange ?? false);
  if ("code" in decision) return { ok: false, code: decision.code };
  return { ok: true, viewer: decision.viewer, email: user.email, supabase };
}

/** Пускать ли в действие (чистая функция — юнит-тест без Supabase). */
export function decideActionGuard(
  result: ViewerResult,
  roles: readonly StaffRole[],
  allowPasswordChange: boolean,
): { viewer: CabinetViewer } | { code: "session" | "forbidden" } {
  if (result.kind === "login") return { code: "session" };
  if (result.kind === "noAccess") return { code: "forbidden" };
  if (result.kind === "changePassword" && !allowPasswordChange) return { code: "forbidden" };
  if (!roles.includes(result.viewer.role)) return { code: "forbidden" };
  return { viewer: result.viewer };
}
