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
import { ADMIN_ROUTES, canOpen, type AdminNavKey } from "./nav";

// Слой доступа кабинета (DAL): кто открыл страницу. Proxy проверяет только наличие сессии,
// а layout не перерисовывается при переходах — поэтому каждая страница и действие спрашивают здесь.

export type CabinetSession = { result: ViewerResult; email: string | null };

const PROFILE_COLUMNS = "id, full_name, role, is_active, must_change_password";

/** Свой профиль под сессией сотрудника (RLS: каждый видит себя). Ошибка сети — исключение. */
export async function readOwnProfile(supabase: SupabaseClient, userId: string): Promise<OwnProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw new Error("cabinet-profile-unavailable", { cause: error });
  return data as OwnProfileRow | null;
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
  return { viewer, allowed: canOpen(viewer.role, key) };
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
  const result = resolveViewer(user.id, profile);
  if (result.kind === "login") return { ok: false, code: "session" };
  if (result.kind === "noAccess") return { ok: false, code: "forbidden" };
  if (result.kind === "changePassword" && !options.allowPasswordChange) return { ok: false, code: "forbidden" };
  if (!roles.includes(result.viewer.role)) return { ok: false, code: "forbidden" };
  return { ok: true, viewer: result.viewer, email: user.email, supabase };
}
