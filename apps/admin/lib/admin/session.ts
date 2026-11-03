import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEV_VIEWER,
  headFactorFresh,
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

/**
 * Второй фактор руководителя: claims токена (aal2, totp за 30 дней) и база — сессия подтверждена
 * тем фактором, секрет которого хранит сервер (own_head_factor). Свой фактор, заведённый в обход
 * кабинета, даёт aal2, но не права руководителя. Спрашиваем базу только у руководителя.
 */
async function headFactorOk(supabase: SupabaseClient, claimsFresh: boolean, profile: OwnProfileRow | null): Promise<boolean> {
  if (!claimsFresh || profile?.role !== "head") return claimsFresh;
  const { data, error } = await supabase.rpc("own_head_factor");
  if (error) throw new Error("cabinet-factor-unavailable", { cause: error });
  return data === true;
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
  const factor = await headFactorOk(supabase, headFactorFresh(data?.claims), profile);
  return { result: resolveViewer(userId, profile, factor), email };
});

/**
 * Сотрудник страницы кабинета; иначе редирект: на вход, на «доступ отключён», на смену пароля или
 * на код второго фактора (руководитель, п. 8).
 */
export async function requireViewer(
  options: { allowPasswordChange?: boolean; allowSecondFactor?: boolean } = {},
): Promise<CabinetViewer> {
  const { result } = await getCabinetSession();
  switch (result.kind) {
    case "login":
      redirect(ADMIN_ROUTES.login);
    case "noAccess":
      redirect(DISABLED_LOGIN_PATH);
    case "changePassword":
      if (options.allowPasswordChange) return result.viewer;
      redirect(ADMIN_ROUTES.password);
    case "secondFactor":
      if (options.allowSecondFactor) return result.viewer;
      redirect(ADMIN_ROUTES.secondFactor);
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

type CurrentUser = { id: string | null; email: string | null; factorFresh: boolean } | { code: "network" };

/**
 * fresh — getUser() спрашивает Auth (видит отозванную сессию), иначе — подпись токена (getClaims).
 * Второй фактор — из claims токена в обоих случаях.
 */
async function currentUser(supabase: SupabaseClient, fresh: boolean): Promise<CurrentUser> {
  const { data, error } = await supabase.auth.getClaims();
  if (error?.name === "AuthRetryableFetchError") return { code: "network" };
  const claims = data?.claims;
  const factorFresh = headFactorFresh(claims);
  if (fresh) {
    const user = await supabase.auth.getUser();
    if (user.error?.name === "AuthRetryableFetchError") return { code: "network" };
    // Токен и Auth — про одного человека: иначе claims чужие.
    const id = user.data.user?.id ?? null;
    return { id, email: user.data.user?.email ?? null, factorFresh: factorFresh && id === (claims?.sub ?? null) };
  }
  return { id: claims?.sub ?? null, email: typeof claims?.email === "string" ? claims.email : null, factorFresh };
}

/**
 * Первая строка каждого Server Action: действие — открытый POST, страница его не защищает.
 * Перед действиями с ключом service_role — fresh: true.
 */
export async function requireActionViewer(
  roles: readonly StaffRole[],
  options: { fresh?: boolean; allowPasswordChange?: boolean; allowSecondFactor?: boolean } = {},
): Promise<ActionGuard> {
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return { ok: false, code: "notConfigured" };
  const supabase = await createSupabaseServerClient();
  const user = await currentUser(supabase, options.fresh ?? false);
  if ("code" in user) return { ok: false, code: user.code };

  let profile: OwnProfileRow | null;
  let factor: boolean;
  try {
    profile = user.id ? await readOwnProfile(supabase, user.id) : null;
    factor = await headFactorOk(supabase, user.factorFresh, profile);
  } catch {
    return { ok: false, code: "network" };
  }
  const decision = decideActionGuard(resolveViewer(user.id, profile, factor), roles, {
    allowPasswordChange: options.allowPasswordChange ?? false,
    allowSecondFactor: options.allowSecondFactor ?? false,
  });
  if ("code" in decision) return { ok: false, code: decision.code };
  return { ok: true, viewer: decision.viewer, email: user.email, supabase };
}

/** Пускать ли в действие (чистая функция — юнит-тест без Supabase). */
export function decideActionGuard(
  result: ViewerResult,
  roles: readonly StaffRole[],
  allow: { allowPasswordChange: boolean; allowSecondFactor?: boolean },
): { viewer: CabinetViewer } | { code: "session" | "forbidden" } {
  if (result.kind === "login") return { code: "session" };
  if (result.kind === "noAccess") return { code: "forbidden" };
  if (result.kind === "changePassword" && !allow.allowPasswordChange) return { code: "forbidden" };
  // Руководитель без второго фактора — только действия экрана кода (п. 8).
  if (result.kind === "secondFactor" && !allow.allowSecondFactor) return { code: "forbidden" };
  if (!roles.includes(result.viewer.role)) return { code: "forbidden" };
  return { viewer: result.viewer };
}
