// Фаза 0: настоящего входа ещё нет (Supabase Auth — фаза 1). Оболочка кабинета открыта
// без входа только при разработке; в продакшен-сборке /admin ведёт на экран входа.
export const isCabinetOpenWithoutLogin = process.env.NODE_ENV !== "production";

/** Роли кабинета (PLAN §3.3): руководитель, менеджер, видеограф. */
export type StaffRole = "head" | "manager" | "videographer";

export type CabinetViewer = {
  role: StaffRole;
  /** null — режим разработки без входа: подпись берётся из messages (admin.user.devName). */
  name: string | null;
};

// Без входа видно всё, что увидит руководитель: так проверяется меню целиком.
const DEV_VIEWER: CabinetViewer = { role: "head", name: null };

export function getCabinetViewer(openWithoutLogin: boolean = isCabinetOpenWithoutLogin): CabinetViewer | null {
  return openWithoutLogin ? DEV_VIEWER : null;
}
