import { hasSupabaseEnv } from "@/lib/supabase/env";

// Без server-only: тип роли нужен тестам базы (tests/db/harness.ts) и клиентским компонентам.

/** Роли кабинета (PLAN §3.3): руководитель, менеджер, мобилограф. Совпадают с enum staff_role. */
export type StaffRole = "head" | "manager" | "mobilographer";

export const STAFF_ROLES: readonly StaffRole[] = ["head", "manager", "mobilographer"];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

export type CabinetViewer = {
  id: string;
  role: StaffRole;
  /** null — режим разработки без входа: подпись берётся из messages (admin.user.devName). */
  name: string | null;
  /** Вошёл с паролем от руководителя — сначала /admin/parol. */
  mustChangePassword: boolean;
};

// Без входа видно всё, что увидит руководитель: так проверяется меню целиком.
export const DEV_VIEWER: CabinetViewer = { id: "dev", role: "head", name: null, mustChangePassword: false };

/**
 * Кабинет без входа — только при разработке и только без ключей Supabase: с ключами
 * проверяется настоящий вход, а продакшен-сборка без ключей ведёт на экран входа.
 */
export function cabinetOpenWithoutLogin(input: { nodeEnv: string | undefined; hasEnv: boolean }): boolean {
  return input.nodeEnv !== "production" && !input.hasEnv;
}

export const isCabinetOpenWithoutLogin = cabinetOpenWithoutLogin({
  nodeEnv: process.env.NODE_ENV,
  hasEnv: hasSupabaseEnv(),
});

/** Строка public.profiles своего сотрудника (select под его сессией). */
export type OwnProfileRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
};

export type ViewerResult =
  | { kind: "ok"; viewer: CabinetViewer }
  | { kind: "changePassword"; viewer: CabinetViewer }
  /** Руководитель без второго фактора за 30 дней (PLAN §10, п. 8) — экран кода /kod. */
  | { kind: "secondFactor"; viewer: CabinetViewer }
  | { kind: "noAccess" }
  | { kind: "login" };

/** Срок второго фактора на устройстве (п. 8) — как private.head_factor_fresh() в базе. */
export const SECOND_FACTOR_DAYS = 30;

type FactorClaims = { aal?: unknown; amr?: unknown };

/** Сессия прошла TOTP (код из Telegram или запасной) не раньше 30 дней назад: aal2 и amr totp. */
export function headFactorFresh(claims: FactorClaims | null | undefined, now: number = Date.now()): boolean {
  if (!claims || claims.aal !== "aal2" || !Array.isArray(claims.amr)) return false;
  const since = now / 1000 - SECOND_FACTOR_DAYS * 86_400;
  return claims.amr.some(
    (entry: unknown) =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as { method?: unknown }).method === "totp" &&
      Number((entry as { timestamp?: unknown }).timestamp) > since,
  );
}

/**
 * Кто открыл кабинет. Роль и «активен» — только из profiles на каждый запрос: в токене их нет
 * (user_metadata правит сам пользователь), а отключение должно действовать сразу.
 */
export function resolveViewer(
  userId: string | null,
  profile: OwnProfileRow | null,
  /** Свежий второй фактор — нужен только руководителю; без claims (стенд) — как пройден. */
  factorFresh = true,
): ViewerResult {
  if (!userId) return { kind: "login" };
  if (!profile || profile.id !== userId || !profile.is_active || !isStaffRole(profile.role)) {
    return { kind: "noAccess" };
  }
  const viewer: CabinetViewer = {
    id: profile.id,
    role: profile.role,
    name: profile.full_name,
    mustChangePassword: profile.must_change_password,
  };
  if (viewer.mustChangePassword) return { kind: "changePassword", viewer };
  return viewer.role === "head" && !factorFresh ? { kind: "secondFactor", viewer } : { kind: "ok", viewer };
}
