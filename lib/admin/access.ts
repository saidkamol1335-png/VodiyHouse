import { hasSupabaseEnv } from "@/lib/supabase/env";

// Без server-only: тип роли нужен тестам базы (tests/db/harness.ts) и клиентским компонентам.

/** Роли кабинета (PLAN §3.3): руководитель, менеджер, видеограф. Совпадают с enum staff_role. */
export type StaffRole = "head" | "manager" | "videographer";

export const STAFF_ROLES: readonly StaffRole[] = ["head", "manager", "videographer"];

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
export const DEV_VIEWER: CabinetViewer = {
  id: "dev",
  role: "head",
  name: null,
  mustChangePassword: false,
};

/**
 * Кабинет без входа — только при разработке и только без ключей Supabase: с ключами
 * проверяется настоящий вход, а продакшен-сборка без ключей ведёт на экран входа.
 */
export function cabinetOpenWithoutLogin(input: {
  nodeEnv: string | undefined;
  hasEnv: boolean;
}): boolean {
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
  | { kind: "noAccess" }
  | { kind: "login" };

/**
 * Кто открыл кабинет. Роль и «активен» — только из profiles на каждый запрос: в токене их нет
 * (user_metadata правит сам пользователь), а отключение должно действовать сразу.
 */
export function resolveViewer(userId: string | null, profile: OwnProfileRow | null): ViewerResult {
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
  return viewer.mustChangePassword ? { kind: "changePassword", viewer } : { kind: "ok", viewer };
}
