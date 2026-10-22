import type { CabinetViewer, ViewerResult } from "./access";
import { ADMIN_ROUTES, landingPath } from "./nav";

/** Экран входа с уведомлением «Ваш доступ отключён» — сюда ведёт отключённого сотрудника. */
export const DISABLED_LOGIN_PATH = `${ADMIN_ROUTES.login}?prichina=otklyuchen`;

/** После входа смена пароля важнее раздела роли. */
export function afterSignInPath(
  viewer: Pick<CabinetViewer, "role" | "mustChangePassword">,
): string {
  return viewer.mustChangePassword ? ADMIN_ROUTES.password : landingPath(viewer.role);
}

/** /admin/parol: null — показать форму; иначе — куда перенаправить. */
export function passwordPageTarget(result: ViewerResult): string | null {
  switch (result.kind) {
    case "login":
      return ADMIN_ROUTES.login;
    case "noAccess":
      return DISABLED_LOGIN_PATH;
    case "ok":
      return landingPath(result.viewer.role);
    case "changePassword":
      return null;
  }
}
