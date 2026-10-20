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
